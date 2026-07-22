"use client";

import { motion } from "framer-motion";
import type { Experience } from "@/services/experiences";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Layout math for the timeline rail, all relative to the outer container's
// left edge (the wire's `left` is measured from there directly; each row's
// node is `position: absolute` relative to the row itself, which sits at
// x = ROW_PADDING_LEFT because that's the container's left padding — so a
// node's `left` has to subtract that padding back out to land at NODE_X).
const LINE_X = 12;
const NODE_SIZE = 14;
const NODE_X = LINE_X + 1 - NODE_SIZE / 2; // centers the node on the line
const ROW_PADDING_LEFT = 40;

function formatRange(start: string, end: string | null): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };
  return `${fmt(start)} — ${end ? fmt(end) : "Present"}`;
}

export default function ExperienceTimeline({ experiences }: { experiences: Experience[] }) {
  return (
    <div style={{ position: "relative", paddingLeft: ROW_PADDING_LEFT }}>
      {/* The wire itself — draws in top-to-bottom on mount */}
      <motion.div
        aria-hidden
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
        style={{
          position: "absolute",
          left: LINE_X,
          top: 6,
          bottom: 6,
          width: 2,
          transformOrigin: "top",
          background: "linear-gradient(180deg, var(--wire-bright) 0%, var(--wire) 60%, transparent 100%)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        {experiences.map((exp, i) => {
          const isCurrent = exp.end_date === null;
          return (
            <motion.div
              key={`${exp.company}-${exp.title}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.12, ease: EASE }}
              style={{ position: "relative" }}
            >
              {/* Node on the wire */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: NODE_X - ROW_PADDING_LEFT,
                  top: 5,
                  width: NODE_SIZE,
                  height: NODE_SIZE,
                  borderRadius: "50%",
                  background: "var(--ink)",
                  border: `2px solid ${isCurrent ? "var(--copper-bright)" : "var(--wire-bright)"}`,
                  boxShadow: isCurrent
                    ? "0 0 0 4px rgba(224,146,90,0.16), 0 0 14px rgba(224,146,90,0.5)"
                    : "0 0 0 4px rgba(143,176,186,0.12)",
                  animation: isCurrent ? "pulse-glow-copper 2.4s ease-in-out infinite" : undefined,
                }}
              />

              <div
                style={{
                  fontFamily: "var(--font-tech), monospace",
                  fontSize: 11.5,
                  letterSpacing: "0.03em",
                  color: isCurrent ? "var(--copper-bright)" : "var(--hero-muted)",
                  marginBottom: 6,
                }}
              >
                {formatRange(exp.start_date, exp.end_date)}
                {isCurrent && " · LIVE"}
              </div>

              <div
                style={{
                  borderRadius: 13,
                  padding: "18px 22px",
                  background: "linear-gradient(160deg, rgba(107,138,148,0.06) 0%, rgba(16,15,12,0.9) 60%)",
                  border: "1px solid var(--hero-line)",
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{exp.title}</h3>
                <p style={{ fontSize: 13, marginTop: 2, color: "var(--wire-bright)" }}>
                  {exp.company}
                  {exp.location ? ` · ${exp.location}` : ""}
                </p>

                {exp.summary && (
                  <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                    {exp.summary}
                  </p>
                )}

                {exp.achievements.length > 0 && (
                  <ul style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8, paddingLeft: 0, listStyle: "none" }}>
                    {exp.achievements.map((a) => (
                      <li key={a} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--wire-bright)", flexShrink: 0 }}>▸</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {exp.tech_stack.length > 0 && (
                  <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {exp.tech_stack.map((t) => (
                      <span
                        key={t}
                        style={{
                          borderRadius: 6,
                          padding: "3px 9px",
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: "var(--font-tech), monospace",
                          background: "rgba(107,138,148,0.1)",
                          color: "var(--wire-bright)",
                          border: "1px solid rgba(107,138,148,0.2)",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
