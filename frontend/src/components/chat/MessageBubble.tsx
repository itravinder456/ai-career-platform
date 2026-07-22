"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, RotateCcw } from "lucide-react";
import { Message } from "@/types/chat";
import WidgetRenderer from "@/components/widgets/WidgetRenderer";
import TypingIndicator from "./TypingIndicator";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// GitHub-Flavored Markdown, themed via the .markdown-body rules in globals.css.
// react-markdown renders partial markdown gracefully, so streaming mid-token is fine.
function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can throw if the tab isn't focused/permitted — the
      // button just silently stays in its unclicked state, no error worth
      // surfacing to the user over a copy affordance.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy response"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        marginLeft: 6,
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 500,
        color: copied ? "var(--copper-bright)" : "var(--text-muted)",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        transition: "color 0.15s ease",
      }}
      onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = "var(--text-secondary)"; }}
      onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = "var(--text-muted)"; }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MessageBubble({ message, onRetry }: { message: Message; onRetry?: () => void }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <motion.div
        style={{ display: "flex", justifyContent: "flex-end" }}
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <div
          style={{
            maxWidth: "80%",
            borderRadius: "18px 18px 4px 18px",
            padding: "11px 16px",
            fontSize: 14,
            lineHeight: 1.65,
            background: "linear-gradient(135deg, var(--copper) 0%, var(--copper-bright) 100%)",
            color: "#fff",
            boxShadow: "0 4px 24px rgba(201,122,61,0.35), 0 1px 0 rgba(255,255,255,0.1) inset",
            wordBreak: "break-word",
            fontWeight: 450,
          }}
        >
          {message.content}
        </div>
      </motion.div>
    );
  }

  const isError = message.isError ?? false;
  const showActions = !message.isStreaming && !!message.content;

  return (
    <motion.div
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      {/* Message body — no avatar/name/step trace: this should read as Ravinder
          replying directly, not as a labeled agent doing visible work. */}
      <div>
        {message.isStreaming && !message.content ? (
          <div
            style={{
              display: "inline-flex",
              borderRadius: "4px 12px 12px 12px",
              padding: "12px 16px",
              background: "rgba(107,138,148,0.06)",
              border: "1px solid rgba(107,138,148,0.14)",
              borderLeft: "2px solid rgba(107,138,148,0.4)",
            }}
          >
            <TypingIndicator />
          </div>
        ) : (
          <div
            style={{
              display: "block",
              width: "100%",
              borderRadius: "4px 14px 14px 14px",
              padding: "14px 18px",
              background: isError
                ? "linear-gradient(135deg, rgba(248,113,113,0.07) 0%, rgba(255,255,255,0.025) 100%)"
                : "linear-gradient(135deg, rgba(107,138,148,0.07) 0%, rgba(255,255,255,0.025) 100%)",
              border: isError ? "1px solid rgba(248,113,113,0.18)" : "1px solid rgba(107,138,148,0.14)",
              borderLeft: isError ? "2px solid rgba(248,113,113,0.45)" : "2px solid rgba(107,138,148,0.4)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 4px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
              wordBreak: "break-word",
            }}
          >
            <MarkdownContent text={message.content} />
            {message.isStreaming && (
              <motion.span
                style={{
                  display: "inline-block",
                  width: 2,
                  height: 13,
                  borderRadius: 2,
                  background: "var(--copper-bright)",
                  marginLeft: 3,
                  verticalAlign: "middle",
                }}
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.55, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </div>
        )}

        {message.widgets && message.widgets.length > 0 && !message.isStreaming && (
          <div style={{ marginTop: 10 }}>
            <WidgetRenderer widgets={message.widgets} />
          </div>
        )}

        <AnimatePresence>
          {showActions && (isError ? !!onRetry : true) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: "flex", alignItems: "center", marginTop: 4 }}
            >
              {isError ? (
                <button
                  type="button"
                  onClick={onRetry}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 10px",
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--hero-line)",
                    borderRadius: 7,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--copper-bright)"; e.currentTarget.style.borderColor = "rgba(201,122,61,0.35)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--hero-line)"; }}
                >
                  <RotateCcw size={12} />
                  Retry
                </button>
              ) : (
                <CopyButton text={message.content} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
