"use client";

import { motion } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface SkillModule {
  label: string;
  items: string[];
}

export default function SkillModuleGrid({ modules }: { modules: SkillModule[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
        gap: 20,
      }}
    >
      {modules.map((mod, i) => (
        <motion.div
          key={mod.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.07, ease: EASE }}
          style={{
            position: "relative",
            borderRadius: 13,
            padding: "18px 20px",
            background: "linear-gradient(160deg, rgba(107,138,148,0.06) 0%, rgba(16,15,12,0.9) 60%)",
            border: "1px solid var(--hero-line)",
            overflow: "hidden",
          }}
        >
          {/* Corner bracket motif — a small techno flourish, not a border */}
          <svg
            aria-hidden
            width="18"
            height="18"
            style={{ position: "absolute", top: 10, right: 10, opacity: 0.5 }}
          >
            <path d="M1 8V1H8" stroke="var(--wire-bright)" strokeWidth="1.2" fill="none" />
          </svg>

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <h3
              style={{
                fontFamily: "var(--font-tech), monospace",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--wire-bright)",
              }}
            >
              {mod.label}
            </h3>
            <span
              style={{
                fontFamily: "var(--font-tech), monospace",
                fontSize: 10.5,
                color: "var(--hero-muted)",
              }}
            >
              {String(mod.items.length).padStart(2, "0")}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mod.items.map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden
                  style={{
                    width: 5,
                    height: 5,
                    flexShrink: 0,
                    background: "var(--copper)",
                    transform: "rotate(45deg)",
                  }}
                />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
