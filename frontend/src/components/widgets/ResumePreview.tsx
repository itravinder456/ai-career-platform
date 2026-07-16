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

export default function ResumePreview({ data }: { data: ResumeData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -1 }}
      className="mt-3 rounded-xl p-5 space-y-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-start justify-between"
      >
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {data.name}
          </h3>
          <p
            className="text-xs mt-0.5"
            style={{
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
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{
            background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
            color: "#fff",
            boxShadow: "0 4px 12px rgba(108,92,231,0.3)",
          }}
        >
          <Download size={11} />
          Resume
        </motion.a>
      </motion.div>

      {/* Experience */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Briefcase size={11} style={{ color: "var(--text-muted)" }} />
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Experience
          </span>
        </div>
        <div className="space-y-2">
          {data.experience.map((exp, i) => (
            <motion.div
              key={exp.company}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 + 0.15 }}
              className="rounded-lg px-3 py-2.5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    {exp.role}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {exp.company}
                  </p>
                </div>
                <span
                  className="text-xs shrink-0 font-mono tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  {exp.duration}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                ↳ {exp.highlight}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Education */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="flex items-center gap-2"
      >
        <GraduationCap size={11} style={{ color: "var(--text-muted)" }} />
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {data.education}
        </span>
      </motion.div>
    </motion.div>
  );
}
