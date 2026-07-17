"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Step } from "@/types/chat";

function StepIcon({ status }: { status: Step["status"] }) {
  if (status === "done") {
    return (
      <span style={{ color: "var(--accent-2)", fontSize: 12, lineHeight: 1, width: 14, textAlign: "center" }}>
        ✓
      </span>
    );
  }
  return (
    <motion.span
      style={{
        width: 11,
        height: 11,
        borderRadius: "50%",
        border: "1.5px solid rgba(167,139,250,0.35)",
        borderTopColor: "var(--accent-2)",
        display: "inline-block",
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
    />
  );
}

export default function StepTrace({ steps, streaming }: { steps: Step[]; streaming?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const show = streaming || expanded;

  return (
    <div style={{ marginBottom: show ? 10 : 4 }}>
      {!streaming && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            fontSize: 11,
            fontWeight: 500,
            padding: "2px 0",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 9 }}>{expanded ? "▾" : "▸"}</span>
          {expanded ? "hide steps" : `${steps.length} steps`}
        </button>
      )}

      <AnimatePresence initial={false}>
        {show && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 5,
              overflow: "hidden",
            }}
          >
            {steps.map((step) => (
              <li
                key={step.id + step.label}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span style={{ width: 14, display: "flex", justifyContent: "center" }}>
                  <StepIcon status={step.status} />
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    color:
                      step.status === "done" ? "var(--text-muted)" : "var(--text-secondary)",
                  }}
                >
                  {step.label}
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
