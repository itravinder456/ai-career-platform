"use client";

import { motion } from "framer-motion";
import type { Experience } from "@/services/experiences";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function formatRange(start: string, end: string | null): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };
  return `${fmt(start)} — ${end ? fmt(end) : "Present"}`;
}

export default function ExperienceTimeline({ experiences }: { experiences: Experience[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {experiences.map((exp, i) => (
        <motion.div
          key={`${exp.company}-${exp.title}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
          style={{ borderRadius: 14, padding: 1 }}
        >
          <div
            style={{
              borderRadius: 14,
              padding: 1,
              background:
                "linear-gradient(135deg, rgba(107,138,148,0.28) 0%, rgba(143,176,186,0.1) 50%, rgba(52,74,82,0.18) 100%)",
            }}
          >
            <div
              style={{
                position: "relative",
                borderRadius: 13,
                padding: "20px 24px",
                background: "linear-gradient(160deg, rgba(107,138,148,0.07) 0%, rgba(16,15,12,0.95) 60%)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: "linear-gradient(90deg, rgba(107,138,148,0.6), rgba(143,176,186,0.3), transparent)",
                  pointerEvents: "none",
                }}
              />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{exp.title}</h3>
                  <p style={{ fontSize: 13, marginTop: 2, color: "var(--wire-bright)" }}>
                    {exp.company}
                    {exp.location ? ` · ${exp.location}` : ""}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 11.5,
                    fontFamily: "var(--font-geist-mono), monospace",
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatRange(exp.start_date, exp.end_date)}
                </span>
              </div>

              {exp.summary && (
                <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>{exp.summary}</p>
              )}

              {exp.achievements.length > 0 && (
                <ul style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8, paddingLeft: 0, listStyle: "none" }}>
                  {exp.achievements.map((a) => (
                    <li key={a} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--wire-bright)", flexShrink: 0 }}>—</span>
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
          </div>
        </motion.div>
      ))}
    </div>
  );
}
