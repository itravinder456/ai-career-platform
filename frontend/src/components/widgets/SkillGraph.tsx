"use client";

import { motion } from "framer-motion";

interface Skill {
  name: string;
  level: number;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function levelLabel(pct: number) {
  if (pct >= 90) return "Expert";
  if (pct >= 75) return "Advanced";
  if (pct >= 55) return "Proficient";
  return "Familiar";
}

export default function SkillGraph({ skills }: { skills: Skill[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      style={{ marginTop: 10, borderRadius: 14, padding: 1 }}
    >
      <div
        style={{
          borderRadius: 14,
          padding: 1,
          background: "linear-gradient(135deg, rgba(107,138,148,0.28) 0%, rgba(143,176,186,0.1) 50%, rgba(52,74,82,0.18) 100%)",
        }}
      >
        <motion.div
          whileHover={{ y: -1 }}
          style={{
            position: "relative",
            borderRadius: 13,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            background: "linear-gradient(160deg, rgba(107,138,148,0.07) 0%, rgba(16,15,12,0.95) 60%)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
            overflow: "hidden",
          }}
        >
          {/* Accent top stripe */}
          <div
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0,
              height: 2,
              background: "linear-gradient(90deg, rgba(107,138,148,0.6), rgba(143,176,186,0.3), transparent)",
              pointerEvents: "none",
            }}
          />

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
              Skills
            </p>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{skills.length} skills</span>
          </div>

          {/* Skill bars */}
          {skills.map((skill, i) => (
            <motion.div
              key={skill.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 + 0.1, duration: 0.35, ease: EASE }}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>
                  {skill.name}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.03em" }}>
                    {levelLabel(skill.level)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-geist-mono), monospace",
                      fontWeight: 600,
                      color: "var(--wire-bright)",
                      minWidth: 34,
                      textAlign: "right",
                    }}
                  >
                    {skill.level}%
                  </span>
                </div>
              </div>
              {/* Track */}
              <div
                style={{
                  height: 5,
                  borderRadius: 99,
                  background: "rgba(255,255,255,0.05)",
                  overflow: "hidden",
                }}
              >
                <motion.div
                  style={{
                    height: "100%",
                    borderRadius: 99,
                    background: "linear-gradient(90deg, var(--wire) 0%, var(--wire-bright) 100%)",
                    boxShadow: "0 0 10px rgba(107,138,148,0.45)",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${skill.level}%` }}
                  transition={{ duration: 0.9, delay: i * 0.07 + 0.15, ease: EASE }}
                />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
