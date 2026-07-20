"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { Message, Widget } from "@/types/chat";
import type { Step } from "@/types/chat";
import { streamChat } from "@/services/chat";
import { GREETING_TEXT } from "@/services/mockAI";
import { FEATURED_QUESTIONS, pickFollowUps } from "@/lib/questions";
import { generateId } from "@/lib/utils";
import MessageBubble from "./MessageBubble";
import WelcomeCard from "./WelcomeCard";
import InputBar from "./InputBar";
import FollowUpChips from "./FollowUpChips";

const SESSION_KEY = "ai_session_id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return generateId();
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateId();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

interface AskSignal {
  q: string;
  nonce: number;
}

interface Props {
  askSignal?: AskSignal;
  onBusyChange?: (busy: boolean) => void;
}

export default function ChatWindow({ askSignal, onBusyChange }: Props) {
  const [greetingId] = useState(generateId);
  // Captured once at mount (lazy initializer, never recomputed): arriving with a
  // question already queued (a landing-page prompt click) means the user's real intent
  // is that question, not watching the canned greeting type itself out first — skip
  // the typing animation entirely and seed the greeting already complete in that case.
  const [skipGreetingAnimation] = useState(() => !!askSignal?.q?.trim());
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: greetingId,
      role: "assistant",
      content: skipGreetingAnimation ? GREETING_TEXT : "",
      isStreaming: !skipGreetingAnimation,
      timestamp: new Date(),
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(!skipGreetingAnimation);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const sessionId = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const isStreamingRef = useRef(true);
  const queuedRef = useRef<string | null>(null);
  const sendRef = useRef<(input: string) => void>(() => {});

  useEffect(() => {
    sessionId.current = getOrCreateSessionId();
  }, []);

  // Keep refs in sync for use inside effects/timers without stale closures.
  useEffect(() => {
    isStreamingRef.current = isStreaming;
    onBusyChange?.(isStreaming);
  }, [isStreaming, onBusyChange]);

  // Greeting typing animation — only the timer lives here; the message already exists.
  // No-ops when skipGreetingAnimation is true: the initial state above already seeded
  // the greeting complete and isStreaming=false, so there's nothing left to animate.
  useEffect(() => {
    if (skipGreetingAnimation) return;

    let cancelled = false;
    let accumulated = "";
    const words = GREETING_TEXT.split(" ");
    let i = 0;

    const timer = setInterval(() => {
      if (cancelled) { clearInterval(timer); return; }
      if (i >= words.length) {
        clearInterval(timer);
        setMessages((prev) =>
          prev.map((m) => (m.id === greetingId ? { ...m, content: accumulated, isStreaming: false } : m))
        );
        setIsStreaming(false);
        setTimeout(() => { if (!cancelled) setShowSuggestions(true); }, 350);
        return;
      }
      accumulated += (i === 0 ? "" : " ") + words[i];
      setMessages((prev) =>
        prev.map((m) => (m.id === greetingId ? { ...m, content: accumulated } : m))
      );
      i++;
    }, 38);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [greetingId, skipGreetingAnimation]);

  // Scrolls only scrollRef itself (never bubbles a scroll request up to ancestors the
  // way `element.scrollIntoView()` can — that walked up to the fixed app root, which
  // has real scrollable overflow from the decorative background blobs, and nudged
  // its scroll position instead of just this container's).
  const scrollToEnd = (behavior: ScrollBehavior) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  // Auto-scroll to the newest content, but only if the user is already near the bottom
  // (so scrolling up to re-read isn't yanked back on every streamed token).
  useEffect(() => {
    if (atBottomRef.current) scrollToEnd("smooth");
  }, [messages]);

  const userHasSent = messages.some((m) => m.role === "user");

  const send = async (input: string) => {
    if (isStreamingRef.current) return;
    setShowSuggestions(false);

    const userMsg: Message = { id: generateId(), role: "user", content: input, timestamp: new Date() };
    const aiId = generateId();
    const aiMsg: Message = { id: aiId, role: "assistant", content: "", isStreaming: true, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setIsStreaming(true);
    // Jump to bottom on a fresh send regardless of prior scroll position.
    atBottomRef.current = true;
    setAtBottom(true);

    const collectedWidgets: Widget[] = [];
    const allDone = (steps?: Step[]) => steps?.map((s) => ({ ...s, status: "done" as const }));

    await streamChat(sessionId.current, input, {
      onStep: (step) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId ? { ...m, steps: [...(allDone(m.steps) ?? []), step] } : m
          )
        );
      },
      onToken: (token) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId ? { ...m, content: m.content + token, steps: allDone(m.steps) } : m
          )
        );
      },
      onWidget: (widget) => {
        collectedWidgets.push(widget);
      },
      onDone: () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? {
                  ...m,
                  isStreaming: false,
                  steps: allDone(m.steps),
                  widgets: collectedWidgets.length ? collectedWidgets : undefined,
                }
              : m
          )
        );
        setIsStreaming(false);
      },
      onError: (message) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, content: `Sorry, something went wrong. ${message}`, isStreaming: false }
              : m
          )
        );
        setIsStreaming(false);
      },
    });
  };

  // Keep the latest `send` in a ref (updated after commit, not during render) so the
  // effects below can call it without stale closures — and this effect is declared
  // before them, so the ref is current by the time they run in the same commit.
  useEffect(() => {
    sendRef.current = send;
  });

  // Externally-triggered questions (sidebar chips, Hero deep-link). If we're mid-stream
  // or still animating the greeting, queue and flush once free.
  useEffect(() => {
    const q = askSignal?.q?.trim();
    if (!q) return;
    if (isStreamingRef.current) queuedRef.current = q;
    else sendRef.current(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askSignal?.nonce]);

  useEffect(() => {
    if (!isStreaming && queuedRef.current) {
      const q = queuedRef.current;
      queuedRef.current = null;
      sendRef.current(q);
    }
  }, [isStreaming]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = gap < 80;
    atBottomRef.current = near;
    setAtBottom(near);
  };

  const scrollToBottom = () => {
    atBottomRef.current = true;
    setAtBottom(true);
    scrollToEnd("smooth");
  };

  const askedLower = new Set(
    messages.filter((m) => m.role === "user").map((m) => m.content.trim().toLowerCase())
  );
  const last = messages[messages.length - 1];
  const showFollowUps =
    !isStreaming &&
    userHasSent &&
    !!last &&
    last.role === "assistant" &&
    !last.isStreaming &&
    !last.content.startsWith("Sorry, something went wrong");
  const followUps = showFollowUps ? pickFollowUps(askedLower, 3) : [];

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: "1 1 0px", minHeight: 0 }}>
      {/* Scrollable messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{ flex: "1 1 0px", minHeight: 0, overflowY: "auto", overflowX: "hidden" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            // Centered for the bare greeting (nothing to anchor to yet, and
            // bottom-anchoring leaves a stark empty void above one message on
            // tall viewports); bottom-anchored once a real exchange is under
            // way, so streamed tokens don't shift the scroll position.
            justifyContent: userHasSent ? "flex-end" : "center",
            minHeight: "100%",
            width: "100%",
            maxWidth: 760,
            margin: "0 auto",
            padding: "32px 20px 16px",
            gap: 20,
          }}
        >
          <AnimatePresence initial={false}>
            {messages.map((msg) =>
              !userHasSent && msg.id === greetingId ? (
                <WelcomeCard
                  key={msg.id}
                  text={msg.content}
                  streaming={msg.isStreaming ?? false}
                  showChips={showSuggestions}
                  onPick={send}
                />
              ) : (
                <MessageBubble key={msg.id} message={msg} />
              )
            )}
          </AnimatePresence>

          {followUps.length > 0 && (
            <FollowUpChips questions={followUps} onPick={send} disabled={isStreaming} />
          )}
        </div>
      </div>

      {/* Scroll-to-bottom */}
      <AnimatePresence>
        {!atBottom && (
          <motion.button
            type="button"
            onClick={scrollToBottom}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            className="scroll-bottom-btn"
            aria-label="Scroll to latest"
          >
            <ArrowDown size={16} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile empty-state suggestions (sidebar carries these on desktop) */}
      <AnimatePresence>
        {showSuggestions && !userHasSent && (
          <motion.div
            className="mobile-suggestions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {FEATURED_QUESTIONS.map((s, i) => (
              <motion.button
                key={s}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => send(s)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="mobile-suggestion-chip"
              >
                {s}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div style={{ flexShrink: 0, width: "100%", maxWidth: 760, margin: "0 auto", padding: "8px 20px 20px" }}>
        <InputBar onSend={send} disabled={isStreaming} />
        <p
          style={{
            marginTop: 8,
            textAlign: "center",
            fontSize: 11,
            color: "var(--text-muted)",
            letterSpacing: "0.01em",
          }}
        >
          <span className="hint-desktop">Enter to send · Shift+Enter for a new line · </span>
          Responses grounded in Ravinder&apos;s profile
        </p>
      </div>
    </div>
  );
}
