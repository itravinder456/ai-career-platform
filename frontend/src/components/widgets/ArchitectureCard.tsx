"use client";

import { motion } from "framer-motion";

interface Layer {
  name: string;
  items: string[];
}

export default function ArchitectureCard({ layers }: { layers: Layer[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -1 }}
      className="mt-3 rounded-xl p-4 space-y-1"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border)",
        backdropFilter: "blur(8px)",
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        Architecture
      </p>

      {layers.map((layer, i) => (
        <div key={layer.name}>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 + 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3"
          >
            {/* Layer label */}
            <div className="flex items-center gap-2 w-24 shrink-0">
              <div className="h-px flex-1" style={{ background: "var(--border)" }} />
              <span
                className="text-xs font-semibold whitespace-nowrap"
                style={{ color: "var(--accent-2)" }}
              >
                {layer.name}
              </span>
            </div>

            {/* Items */}
            <div className="flex flex-wrap gap-1.5">
              {layer.items.map((item, j) => (
                <motion.span
                  key={item}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 + j * 0.04 + 0.15 }}
                  className="rounded-md px-2 py-0.5 text-xs"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {item}
                </motion.span>
              ))}
            </div>
          </motion.div>

          {i < layers.length - 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 + 0.2 }}
              className="ml-[88px] mt-1 mb-1 flex items-center gap-1"
            >
              <div
                className="w-px h-3 rounded-full"
                style={{ background: "var(--border)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>↓</span>
            </motion.div>
          )}
        </div>
      ))}
    </motion.div>
  );
}
