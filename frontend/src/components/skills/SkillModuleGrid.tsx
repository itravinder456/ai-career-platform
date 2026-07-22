"use client";

import { motion } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface SkillModule {
  label: string;
  items: string[];
}

export default function SkillModuleGrid({ modules }: { modules: SkillModule[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {modules.map((mod, i) => (
        <motion.div
          key={mod.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.07, ease: EASE }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <h3
              style={{
                fontFamily: "var(--font-tech), monospace",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--hero-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {mod.label}
            </h3>
            <span style={{ flex: 1, height: 1, background: "var(--hero-line)" }} />
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

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {/* Same neutral pill treatment as the tech_stack pills on
                Projects/Experience — one tag component, reused everywhere. */}
            {mod.items.map((item) => (
              <span
                key={item}
                style={{
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: "var(--hero-surface)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--hero-line-bright)",
                  letterSpacing: "0.01em",
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
