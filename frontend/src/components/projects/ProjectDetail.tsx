"use client";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

export default function ProjectDetail({
  description,
  demoUrl,
}: {
  description: string | null;
  demoUrl: string | null;
}) {
  if (!description && !demoUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      style={{
        marginTop: -4,
        marginBottom: 14,
        padding: "14px 20px",
        borderRadius: "0 0 13px 13px",
        borderTop: "1px dashed rgba(107,138,148,0.2)",
        background: "rgba(107,138,148,0.03)",
      }}
    >
      {description && (
        <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>{description}</p>
      )}
      {demoUrl && (
        <a
          href={demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginTop: 10,
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
