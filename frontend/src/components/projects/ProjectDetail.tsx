"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ExternalLink } from "lucide-react";

export default function ProjectDetail({
  description,
  demoUrl,
}: {
  description: string | null;
  demoUrl: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!description && !demoUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      style={{
        marginTop: -4,
        marginBottom: 14,
        borderRadius: "0 0 13px 13px",
        borderTop: "1px dashed rgba(107,138,148,0.2)",
        background: "rgba(107,138,148,0.03)",
        overflow: "hidden",
      }}
    >
      {description && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            width: "100%",
            padding: "10px 20px",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 11.5,
            fontWeight: 600,
            color: "var(--text-muted)",
            fontFamily: "var(--font-tech), monospace",
            letterSpacing: "0.03em",
          }}
        >
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: "flex" }}
          >
            <ChevronDown size={13} />
          </motion.span>
          {open ? "Show less" : "Read the full breakdown"}
        </button>
      )}

      <AnimatePresence initial={false}>
        {description && open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <p style={{ padding: "0 20px 14px", fontSize: 12.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>
              {description}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {demoUrl && (
        <a
          href={demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            margin: "0 20px 14px",
            fontSize: 11.5,
            fontWeight: 600,
            color: "var(--accent-2)",
            textDecoration: "none",
          }}
        >
          Live demo <ExternalLink size={11} />
        </a>
      )}
    </motion.div>
  );
}
