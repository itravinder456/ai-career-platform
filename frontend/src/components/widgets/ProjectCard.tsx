"use client";

import { motion } from "framer-motion";
import { ExternalLink, GitBranch, Zap } from "lucide-react";

interface ProjectData {
  name: string;
  description: string;
  impact: string[];
  tech: string[];
  github?: string;
  status: string;
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

export default function ProjectCard({ data }: { data: ProjectData }) {
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
            display: "flex",
            flexDirection: "column",
            gap: 14,
            background: "linear-gradient(160deg, rgba(107,138,148,0.07) 0%, rgba(16,15,12,0.95) 60%)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
            cursor: "default",
            transition: "box-shadow 0.25s ease",
            overflow: "hidden",
          }}
        >
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            style={{ display: "contents" }}
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

            {/* Header */}
            <motion.div variants={item} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "var(--green)",
                      boxShadow: "0 0 8px var(--green), 0 0 16px rgba(34,211,165,0.3)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--green)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {data.status}
                  </span>
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  {data.name}
                </h3>
              </div>
              {data.github && (
                <motion.a
                  href={data.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    borderRadius: 8,
                    padding: "5px 10px",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--text-muted)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.03)",
                    textDecoration: "none",
                    flexShrink: 0,
                    transition: "border-color 0.2s, color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(201,122,61,0.4)";
                    e.currentTarget.style.color = "var(--accent-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  <GitBranch size={11} />
                  <span>GitHub</span>
                  <ExternalLink size={10} />
                </motion.a>
              )}
            </motion.div>

            {/* Description */}
            <motion.p
              variants={item}
              style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--text-secondary)" }}
            >
              {data.description}
            </motion.p>

            {/* Impact grid */}
            <motion.div variants={item}>
              <p style={{ marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                Impact
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {data.impact.map((imp) => (
                  <div
                    key={imp}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                      borderRadius: 8,
                      padding: "8px 10px",
                      background: "rgba(107,138,148,0.07)",
                      border: "1px solid rgba(107,138,148,0.14)",
                    }}
                  >
                    <Zap size={11} style={{ color: "var(--wire-bright)", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--text-secondary)" }}>{imp}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Tech pills */}
            <motion.div variants={item} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {data.tech.map((t, i) => (
                <motion.span
                  key={t}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 + 0.2 }}
                  style={{
                    borderRadius: 6,
                    padding: "3px 9px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "rgba(107,138,148,0.1)",
                    color: "var(--wire-bright)",
                    border: "1px solid rgba(107,138,148,0.2)",
                    letterSpacing: "0.01em",
                  }}
                >
                  {t}
                </motion.span>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
