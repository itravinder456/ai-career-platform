"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppState } from "@/types/chat";
import Hero from "@/components/landing/Hero";
import ChatWindow from "@/components/chat/ChatWindow";
import Navbar from "@/components/ui/Navbar";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function Home() {
  const [state, setState] = useState<AppState>("landing");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      <Navbar state={state} />

      <AnimatePresence mode="wait">
        {state === "landing" ? (
          <motion.div
            key="landing"
            style={{ position: "absolute", inset: 0 }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97, filter: "blur(4px)" }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <Hero onStart={() => setState("chat")} />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            style={{
              position: "absolute",
              inset: 0,
              paddingTop: 56,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* ── Atmospheric depth layers ─────────────────────────────── */}
            {/* Top-right purple glow */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: -120,
                right: -80,
                width: 520,
                height: 520,
                borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(124,95,248,0.09) 0%, transparent 68%)",
                filter: "blur(55px)",
                pointerEvents: "none",
                animation: "drift 14s ease-in-out infinite",
              }}
            />
            {/* Bottom-left indigo glow */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                bottom: -80,
                left: -60,
                width: 440,
                height: 440,
                borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(79,70,229,0.07) 0%, transparent 68%)",
                filter: "blur(60px)",
                pointerEvents: "none",
                animation: "drift 18s ease-in-out infinite 6s",
              }}
            />
            {/* Center aurora beneath chat column */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "55%",
                left: "50%",
                width: 700,
                height: 360,
                borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(124,95,248,0.055) 0%, transparent 70%)",
                filter: "blur(50px)",
                pointerEvents: "none",
                animation: "aurora 10s ease-in-out infinite 2s",
              }}
            />
            {/* Subtle green accent — bottom right */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                bottom: "8%",
                right: "8%",
                width: 260,
                height: 260,
                borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(34,211,165,0.04) 0%, transparent 70%)",
                filter: "blur(40px)",
                pointerEvents: "none",
                animation: "drift 22s ease-in-out infinite 10s",
              }}
            />

            {/* Chat column */}
            <div
              style={{
                width: "100%",
                maxWidth: 660,
                flex: "1 1 0px",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <ChatWindow />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
