"use client";

import { motion } from "framer-motion";

interface Layer {
  name: string;
  items: string[];
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE } },
};

export default function ArchitectureCard({ layers }: { layers: Layer[] }) {
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

          <p
            style={{
              marginBottom: 14,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
            }}
          >
            Architecture
          </p>

          <motion.div variants={container} initial="hidden" animate="show">
            {layers.map((layer, i) => (
              <div key={layer.name}>
                <motion.div
                  variants={item}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  {/* Layer label */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: 96, flexShrink: 0 }}>
                    <div style={{ height: 1, flex: 1, background: "rgba(107,138,148,0.2)" }} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        color: "var(--wire-bright)",
                      }}
                    >
                      {layer.name}
                    </span>
                  </div>

                  {/* Items */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {layer.items.map((layerItem) => (
                      <span
                        key={layerItem}
                        style={{
                          borderRadius: 6,
                          padding: "3px 9px",
                          fontSize: 11,
                          fontWeight: 500,
                          background: "rgba(107,138,148,0.07)",
                          color: "var(--text-secondary)",
                          border: "1px solid rgba(107,138,148,0.14)",
                        }}
                      >
                        {layerItem}
                      </span>
                    ))}
                  </div>
                </motion.div>

                {i < layers.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.08 + 0.25 }}
                    style={{
                      marginLeft: 88,
                      marginTop: 4,
                      marginBottom: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <div style={{ width: 1, height: 12, borderRadius: 2, background: "rgba(107,138,148,0.2)" }} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>↓</span>
                  </motion.div>
                )}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
