"use client";

import { motion } from "framer-motion";

interface Category {
  label: string;
  items: string[];
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

export default function TechStack({ categories }: { categories: Category[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      style={{ marginTop: 10, borderRadius: 14, padding: 1 }}
    >
      {/* Gradient border wrapper */}
      <div
        style={{
          borderRadius: 14,
          padding: 1,
          background: "linear-gradient(135deg, rgba(107,138,148,0.3) 0%, rgba(143,176,186,0.12) 50%, rgba(52,74,82,0.2) 100%)",
        }}
      >
        <motion.div
          whileHover={{ y: -1 }}
          style={{
            position: "relative",
            borderRadius: 13,
            padding: "18px 20px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            background: "linear-gradient(160deg, rgba(107,138,148,0.07) 0%, rgba(16,15,12,0.95) 60%)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
            cursor: "default",
            overflow: "hidden",
          }}
        >
          {/* Accent top stripe */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              borderRadius: "13px 13px 0 0",
              background: "linear-gradient(90deg, rgba(107,138,148,0.6), rgba(143,176,186,0.3), transparent)",
              pointerEvents: "none",
            }}
          />

          <motion.div variants={container} initial="hidden" animate="show" style={{ display: "contents" }}>
            {categories.map((cat) => (
              <motion.div key={cat.label} variants={item}>
                <p
                  style={{
                    marginBottom: 8,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-muted)",
                  }}
                >
                  {cat.label}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {cat.items.map((skillItem) => (
                    <span
                      key={skillItem}
                      style={{
                        borderRadius: 6,
                        padding: "3px 9px",
                        fontSize: 11,
                        fontWeight: 600,
                        background: "var(--hero-surface)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--hero-line-bright)",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {skillItem}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
