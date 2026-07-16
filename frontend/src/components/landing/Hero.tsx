"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useMotionTemplate } from "framer-motion";
import Particles from "./Particles";

interface HeroProps {
  onStart: () => void;
}

const ROTATING_TITLES = [
  "Senior AI Platform Engineer",
  "Building Agentic AI Systems",
  "LangGraph · MCP · RAG",
  "Multi-Agent Architecture",
];

const STATS = [
  { value: "5+", label: "Years AI/ML" },
  { value: "10+", label: "Systems Shipped" },
  { value: "3", label: "LLM Frameworks" },
];

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function Hero({ onStart }: HeroProps) {
  const [titleIndex, setTitleIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(40);
  const springX = useSpring(mouseX, { stiffness: 30, damping: 15 });
  const springY = useSpring(mouseY, { stiffness: 30, damping: 15 });
  const gradBg = useMotionTemplate`radial-gradient(ellipse 80% 60% at ${springX}% ${springY}%, rgba(124,95,248,0.18) 0%, rgba(100,60,230,0.06) 40%, transparent 70%)`;

  useEffect(() => {
    const id = setInterval(() => setTitleIndex((i) => (i + 1) % ROTATING_TITLES.length), 2600);
    return () => clearInterval(id);
  }, []);

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(((e.clientX - rect.left) / rect.width) * 100);
    mouseY.set(((e.clientY - rect.top) / rect.height) * 100);
  };

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden dot-grid"
      onMouseMove={onMouseMove}
    >
      {/* Dot-grid fade-out at edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 75% 75% at 50% 50%, transparent 30%, var(--bg) 100%)",
        }}
      />

      {/* Reactive mouse gradient */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: gradBg }}
      />

      {/* Strong static center glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 800,
          height: 600,
          left: "50%",
          top: "48%",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(ellipse, rgba(100,60,230,0.14) 0%, rgba(80,40,200,0.05) 45%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(30px)",
        }}
      />

      {/* Top-left accent blob */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 350,
          height: 350,
          left: "-5%",
          top: "-5%",
          background: "radial-gradient(circle, rgba(124,95,248,0.08) 0%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(60px)",
        }}
      />

      {/* Bottom-right accent blob */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 280,
          height: 280,
          right: "-2%",
          bottom: "5%",
          background: "radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(60px)",
        }}
      />

      <Particles />

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col items-center gap-6 px-6 text-center"
      >
        {/* Status badge */}
        <motion.div variants={itemVariants}>
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase"
            style={{
              border: "1px solid rgba(124,95,248,0.35)",
              color: "var(--accent-2)",
              background: "rgba(124,95,248,0.08)",
              letterSpacing: "0.12em",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: "var(--green)",
                boxShadow: "0 0 8px var(--green), 0 0 16px rgba(34,211,165,0.3)",
                animation: "pulse-glow 2s ease infinite",
              }}
            />
            Available for opportunities
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div variants={itemVariants} className="space-y-1">
          <h1
            className="text-6xl font-bold tracking-tight sm:text-7xl lg:text-8xl"
            style={{
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              background: "linear-gradient(160deg, #ffffff 0%, #e0d8ff 30%, #a78bfa 65%, #7c5ff8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 40px rgba(124,95,248,0.35))",
            }}
          >
            Ravinder AI
          </h1>
        </motion.div>

        {/* Rotating subtitle */}
        <motion.div variants={itemVariants} className="h-7 overflow-hidden flex items-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={titleIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32, ease: "easeInOut" }}
              className="text-base sm:text-lg font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {ROTATING_TITLES[titleIndex]}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Description */}
        <motion.p
          variants={itemVariants}
          className="max-w-[380px] text-sm leading-relaxed sm:text-[15px]"
          style={{ color: "var(--text-muted)" }}
        >
          Don&apos;t browse a portfolio — talk to my AI. Ask about projects,
          architecture decisions, or paste a JD for an instant fit score.
        </motion.p>

        {/* CTA button */}
        <motion.div variants={itemVariants} className="flex flex-col items-center gap-3 pt-1">
          <motion.button
            onClick={onStart}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 450, damping: 22 }}
            className="group relative overflow-hidden rounded-full text-sm font-semibold"
            style={{
              padding: "14px 40px",
              background: "linear-gradient(135deg, #7c5ff8 0%, #a78bfa 100%)",
              color: "#fff",
              letterSpacing: "0.02em",
              boxShadow: "0 0 0 1px rgba(124,95,248,0.4), 0 8px 32px rgba(124,95,248,0.4), 0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {/* Animated shimmer on hover */}
            <span
              className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_0.7s_ease_forwards]"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
              }}
            />
            <span className="relative z-10 flex items-center gap-2.5">
              Talk with Me
              <motion.svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                initial={{ x: 0 }}
                whileHover={{ x: 3 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
            </span>
          </motion.button>

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No login · No setup · Just ask
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-8 pt-2"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: "28px",
            marginTop: "4px",
          }}
        >
          {STATS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-8">
              <div className="text-center">
                <p
                  className="text-2xl font-bold tabular-nums leading-none"
                  style={{
                    background: "linear-gradient(135deg, #fff 0%, #a78bfa 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {s.value}
                </p>
                <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
                  {s.label}
                </p>
              </div>
              {i < STATS.length - 1 && (
                <div
                  className="w-px h-10"
                  style={{ background: "rgba(255,255,255,0.07)" }}
                />
              )}
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom vignette */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: "linear-gradient(to top, var(--bg) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
