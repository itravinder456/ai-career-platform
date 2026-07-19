"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";

interface InputBarProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function InputBar({ onSend, disabled }: InputBarProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = value.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        borderRadius: 16,
        padding: "12px 14px",
        background: "rgba(255,255,255,0.04)",
        // Border via outline so it animates without layout shift
        outline: focused
          ? "1.5px solid rgba(201,122,61,0.7)"
          : "1px solid rgba(255,255,255,0.09)",
        boxShadow: focused
          ? "0 0 0 3px rgba(201,122,61,0.1), 0 2px 16px rgba(0,0,0,0.3)"
          : "0 2px 8px rgba(0,0,0,0.2)",
        transition: "outline 0.18s ease, box-shadow 0.18s ease",
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        onInput={onInput}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Ask anything about Ravinder..."
        rows={1}
        disabled={disabled}
        style={{
          flex: 1,
          resize: "none",
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--text-primary)",
          caretColor: "var(--accent-2)",
          maxHeight: 160,
          fontFamily: "inherit",
        }}
        // CSS placeholder color via a global class
        className="chat-input"
      />

      {/* Send / loading button */}
      <AnimatePresence mode="wait">
        {disabled ? (
          <motion.div
            key="spinner"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              style={{ animation: "spin 0.75s linear infinite" }}
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                fill="none"
                stroke="rgba(143,176,186,0.25)"
                strokeWidth="2"
              />
              <path
                d="M8 2 A6 6 0 0 1 14 8"
                fill="none"
                stroke="#8fb0ba"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </motion.div>
        ) : (
          <motion.button
            key="send"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
            onClick={submit}
            disabled={!canSend}
            whileHover={canSend ? { scale: 1.08 } : {}}
            whileTap={canSend ? { scale: 0.9 } : {}}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              cursor: canSend ? "pointer" : "default",
              background: canSend
                ? "linear-gradient(135deg, var(--copper) 0%, var(--copper-bright) 100%)"
                : "rgba(255,255,255,0.05)",
              color: "#fff",
              opacity: canSend ? 1 : 0.3,
              boxShadow: canSend ? "0 4px 14px rgba(201,122,61,0.4)" : "none",
              transition: "background 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
