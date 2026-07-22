"use client";

import { motion } from "framer-motion";

// Same bounce language as chat/TypingIndicator.tsx, just bigger and centered
// as a standalone page-level state rather than an inline chat affordance.
export default function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 200,
        gap: 8,
      }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{
            display: "block",
            borderRadius: "50%",
            width: 9,
            height: 9,
            background: i === 1 ? "var(--copper)" : "var(--copper-bright)",
          }}
          animate={{
            y: [0, -8, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
