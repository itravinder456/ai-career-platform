"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Message, Widget } from "@/types/chat";
import { streamChat } from "@/services/chat";
import { GREETING_TEXT, SUGGESTIONS } from "@/services/mockAI";
import { generateId } from "@/lib/utils";
import MessageBubble from "./MessageBubble";
import InputBar from "./InputBar";

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

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const sessionId = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionId.current = getOrCreateSessionId();
  }, []);

  // Animate the greeting locally — no backend round-trip needed.
  // Cleanup resets state so React StrictMode's double-invocation restarts cleanly.
  useEffect(() => {
    const id = generateId();
    setMessages([{ id, role: "assistant", content: "", isStreaming: true, timestamp: new Date() }]);
    setIsStreaming(true);
    setShowSuggestions(false);

    let cancelled = false;
    let accumulated = "";
    const words = GREETING_TEXT.split(" ");
    let i = 0;

    const timer = setInterval(() => {
      if (cancelled) { clearInterval(timer); return; }
      if (i >= words.length) {
        clearInterval(timer);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: accumulated, isStreaming: false } : m))
        );
        setIsStreaming(false);
        setTimeout(() => { if (!cancelled) setShowSuggestions(true); }, 350);
        return;
      }
      accumulated += (i === 0 ? "" : " ") + words[i];
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: accumulated } : m))
      );
      i++;
    }, 38);

    return () => {
      cancelled = true;
      clearInterval(timer);
      setMessages([]);
      setIsStreaming(false);
      setShowSuggestions(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const userHasSent = messages.some((m) => m.role === "user");

  const send = async (input: string) => {
    if (isStreaming) return;
    setShowSuggestions(false);

    const userMsg: Message = { id: generateId(), role: "user", content: input, timestamp: new Date() };
    const aiId = generateId();
    const aiMsg: Message = { id: aiId, role: "assistant", content: "", isStreaming: true, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setIsStreaming(true);

    const collectedWidgets: Widget[] = [];

    await streamChat(sessionId.current, input, {
      onToken: (token) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, content: m.content + token } : m))
        );
      },
      onWidget: (widget) => {
        collectedWidgets.push(widget);
      },
      onDone: () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, isStreaming: false, widgets: collectedWidgets.length ? collectedWidgets : undefined }
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: "1 1 0px",
        minHeight: 0,
      }}
    >
      {/* Scrollable messages — flex-end so messages grow from the bottom */}
      <div
        style={{
          flex: "1 1 0px",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            minHeight: "100%",
            padding: "32px 16px 16px",
            gap: 20,
          }}
        >
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestions */}
      <AnimatePresence>
        {showSuggestions && !userHasSent && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              flexShrink: 0,
              padding: "0 16px 10px",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={s}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => send(s)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                style={{
                  borderRadius: 99,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--text-secondary)",
                  background: "rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  transition: "border-color 0.2s, color 0.2s, background 0.2s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = "rgba(124,95,248,0.5)";
                  el.style.color = "var(--accent-2)";
                  el.style.background = "rgba(124,95,248,0.07)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = "rgba(255,255,255,0.08)";
                  el.style.color = "var(--text-secondary)";
                  el.style.background = "rgba(255,255,255,0.04)";
                }}
              >
                {s}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div style={{ flexShrink: 0, padding: "8px 16px 20px" }}>
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
          AI-powered · Responses based on Ravinder's profile
        </p>
      </div>
    </div>
  );
}
