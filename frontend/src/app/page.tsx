"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppState } from "@/types/chat";
import { clearSession } from "@/services/chat";
import Hero from "@/components/landing/Hero";
import ChatWindow from "@/components/chat/ChatWindow";
import ChatSidebar from "@/components/chat/ChatSidebar";
import Navbar from "@/components/ui/Navbar";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SESSION_KEY = "ai_session_id";

export default function Home() {
  const [state, setState] = useState<AppState>("landing");
  const [askSignal, setAskSignal] = useState({ q: "", nonce: 0 });
  const [busy, setBusy] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [heroScrolled, setHeroScrolled] = useState(false);

  const ask = (q: string) => setAskSignal((s) => ({ q, nonce: s.nonce + 1 }));

  const startChat = (question?: string) => {
    setState("chat");
    setHeroScrolled(false); // stale otherwise: this state outlives Hero's own mount cycle
    if (question) ask(question);
  };

  const newChat = () => {
    if (typeof window !== "undefined") {
      const id = sessionStorage.getItem(SESSION_KEY);
      if (id) clearSession(id).catch(() => {});
      sessionStorage.removeItem(SESSION_KEY);
    }
    setAskSignal({ q: "", nonce: 0 });
    setBusy(false);
    setChatKey((k) => k + 1); // remount ChatWindow → fresh greeting + new session
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        // `clip`, not `hidden`: hidden still lets scrollIntoView()/focus programmatically
        // scroll this box if it has any scrollable overflow (e.g. from the decorative
        // absolutely-positioned blobs inside Hero) — clip forbids scrolling outright.
        overflow: "clip",
      }}
    >
      <Navbar
        state={state}
        onGoHome={() => {
          setState("landing");
          setHeroScrolled(false); // Hero remounts fresh at scrollTop 0; match that here too
          // ChatWindow remounts fresh the next time chat opens, and its askSignal-consuming
          // effect fires unconditionally on mount — leaving q non-empty here would replay
          // whatever question was last asked, as if the user had just clicked it again.
          setAskSignal((s) => ({ ...s, q: "" }));
        }}
        scrolled={heroScrolled}
      />

      {/* No `mode="wait"` here on purpose: the two views should cross-fade — old
          fading out while new fades in — rather than fully exit before the next
          one mounts. That sequential gap is what made switching views read as a
          hard page navigation instead of an in-app transition. */}
      <AnimatePresence>
        {state === "landing" ? (
          <motion.div
            key="landing"
            style={{ position: "absolute", inset: 0 }}
            initial={{ opacity: 0, scale: 1.01 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <Hero onStart={startChat} onScroll={setHeroScrolled} />
          </motion.div>
        ) : (
          // Only `opacity` is animated on this outer box, never `transform`/`filter`:
          // this is what position:absolute;inset:0 and the percentage-height chain
          // (.chat-shell etc.) are anchored to. Framer Motion applies `transform`
          // directly to whatever element it animates — if that same element also
          // establishes this layout box, some browsers compute its height once on
          // the first paint (before the transform settles) and never re-invalidate
          // it, since transform changes are deliberately layout-independent. Scale/
          // slide motion lives on the inner chat-shell (below) instead, which has
          // nothing measuring percentages against it.
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            style={{
              position: "absolute",
              inset: 0,
              paddingTop: 56,
              display: "flex",
              justifyContent: "center",
              minHeight: 0,
            }}
          >
            {/* ── Atmospheric depth layers ─────────────────────────────── */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: -120,
                right: -80,
                width: 520,
                height: 520,
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse, rgba(201,122,61,0.09) 0%, transparent 68%)",
                filter: "blur(55px)",
                pointerEvents: "none",
                animation: "drift 14s ease-in-out infinite",
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                bottom: -80,
                left: -60,
                width: 440,
                height: 440,
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse, rgba(107,138,148,0.07) 0%, transparent 68%)",
                filter: "blur(60px)",
                pointerEvents: "none",
                animation: "drift 18s ease-in-out infinite 6s",
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "58%",
                left: "58%",
                width: 700,
                height: 360,
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse, rgba(201,122,61,0.05) 0%, transparent 70%)",
                filter: "blur(50px)",
                pointerEvents: "none",
                animation: "aurora 10s ease-in-out infinite 2s",
              }}
            />

            {/* Two-column app shell — entrance animation lives here, not on the
                position:absolute box above, so its transform never touches the
                element the percentage-height chain is anchored to. */}
            <motion.div
              className="chat-shell"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <ChatSidebar onAsk={ask} onNewChat={newChat} busy={busy} />
              <div className="chat-main">
                <ChatWindow
                  key={chatKey}
                  askSignal={askSignal}
                  onBusyChange={setBusy}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
