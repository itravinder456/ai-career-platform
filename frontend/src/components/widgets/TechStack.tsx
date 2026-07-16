"use client";

import { motion } from "framer-motion";

interface Category {
  label: string;
  items: string[];
}

export default function TechStack({ categories }: { categories: Category[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -1 }}
      className="mt-3 rounded-xl p-4 grid grid-cols-2 gap-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border)",
        backdropFilter: "blur(8px)",
      }}
    >
      {categories.map((cat, ci) => (
        <motion.div
          key={cat.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ci * 0.08, duration: 0.35 }}
        >
          <p
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            {cat.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cat.items.map((item, i) => (
              <motion.span
                key={item}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: ci * 0.08 + i * 0.04 + 0.1 }}
                whileHover={{ scale: 1.05, borderColor: "rgba(108,92,231,0.5)" }}
                className="rounded-md px-2 py-0.5 text-xs font-medium cursor-default"
                style={{
                  background: "rgba(108,92,231,0.08)",
                  color: "var(--accent-2)",
                  border: "1px solid rgba(108,92,231,0.18)",
                  transition: "border-color 0.2s ease",
                }}
              >
                {item}
              </motion.span>
            ))}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
