"use client";

import { motion } from "framer-motion";
import { Download, Briefcase, GraduationCap } from "lucide-react";

interface Experience {
  company: string;
  role: string;
  duration: string;
  highlight: string;
}

interface ResumeData {
  name: string;
  title: string;
  experience: Experience[];
  education: string;
  downloadUrl: string;
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

export default function ResumePreview({ data }: { data: ResumeData }) {
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
          <motion.div variants={container} initial="hidden" animate="show" style={{ display: "contents" }}>
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
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  {data.name}
                </h3>
                <p
                  style={{
                    fontSize: 12,
                    marginTop: 3,
                    background: "linear-gradient(90deg, var(--accent-2) 0%, var(--accent-3) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {data.title}
                </p>
              </div>
              <motion.a
                href={data.downloadUrl}
                download
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  borderRadius: 8,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#fff",
                  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
                  boxShadow: "0 4px 12px rgba(201,122,61,0.3)",
                  textDecoration: "none",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                <Download size={11} />
                Resume
              </motion.a>
            </motion.div>

            {/* Experience */}
            <motion.div variants={item}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Briefcase size={11} style={{ color: "var(--text-muted)" }} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                  Experience
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.experience.map((exp) => (
                  <div
                    key={exp.company}
                    style={{
                      borderRadius: 8,
                      padding: "8px 10px",
                      background: "rgba(107,138,148,0.07)",
                      border: "1px solid rgba(107,138,148,0.14)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{exp.role}</p>
                        <p style={{ fontSize: 11.5, marginTop: 1, color: "var(--text-secondary)" }}>{exp.company}</p>
                      </div>
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: 10.5,
                          fontFamily: "var(--font-mono, monospace)",
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--text-muted)",
                        }}
                      >
                        {exp.duration}
                      </span>
                    </div>
                    <p style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                      ↳ {exp.highlight}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Education */}
            <motion.div
              variants={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                paddingTop: 12,
                borderTop: "1px solid rgba(107,138,148,0.14)",
              }}
            >
              <GraduationCap size={11} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{data.education}</span>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
