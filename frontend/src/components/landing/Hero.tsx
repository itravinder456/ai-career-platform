"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { FEATURED_QUESTIONS } from "@/lib/questions";
import { useProfile } from "@/hooks/useProfile";
import GraphCarousel from "./GraphCarousel";

interface HeroProps {
  onStart: (question?: string) => void;
  onScroll?: (scrolled: boolean) => void;
}

const ROTATING_ROLES = [
  "Senior AI Platform Engineer",
  "Building Agentic AI Systems",
  "LangGraph · MCP · RAG",
  "Multi-Agent Architecture",
];

// Used only if the api service is unreachable — see useProfile()'s own
// fallback pattern for links. Kept in sync with the seed migration
// (services/api/alembic/versions/..._add_profile_stats.py) as a starting point,
// not a second source of truth: Postgres wins whenever it's reachable.
const FALLBACK_STATS = [
  { value: "6+", label: "Years AI/ML" },
  { value: "10+", label: "Systems Shipped" },
  { value: "3", label: "LLM Frameworks" },
];

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function Hero({ onStart, onScroll }: HeroProps) {
  const { profile } = useProfile();
  const [roleIndex, setRoleIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setRoleIndex((i) => (i + 1) % ROTATING_ROLES.length), 2600);
    return () => clearInterval(id);
  }, []);

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  };

  return (
    <div
      className="relative h-full w-full overflow-y-auto overflow-x-hidden dot-grid"
      style={{ background: "var(--ink)" }}
      onScroll={(e) => onScroll?.(e.currentTarget.scrollTop > 4)}
    >
      {/* Bottom vignette so the dot-grid fades rather than hard-cuts */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, transparent 40%, var(--ink) 100%)",
        }}
      />

      {/* Ambient copper/wire glow — gives the graph panel something to sit in
          instead of flat black, echoing the same dual-glow used behind the
          chat's welcome card so both surfaces read as one visual language. */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "8%",
          right: "6%",
          width: 640,
          height: 640,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(107,138,148,0.14) 0%, transparent 68%)",
          filter: "blur(70px)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "38%",
          left: "2%",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(201,122,61,0.1) 0%, transparent 68%)",
          filter: "blur(60px)",
        }}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 hero2"
        style={{ paddingTop: 96, paddingBottom: 56 }}
      >
        <div className="hero2-grid">
          {/* ── Identity ─────────────────────────────────────────────── */}
          <motion.div variants={itemVariants}>
            <div className="hero2-eyebrow">
              <span className="dot" />
              AVAILABLE FOR OPPORTUNITIES
            </div>

            <h1 className="hero2-name">{profile?.name ?? "Ravinder Varikuppala"}</h1>

            <div className="hero2-role">
              <AnimatePresence mode="wait">
                <motion.span
                  key={roleIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  style={{ display: "inline-block" }}
                >
                  {ROTATING_ROLES[roleIndex]}
                </motion.span>
              </AnimatePresence>
            </div>

            <p className="hero2-pitch">
              Don&apos;t browse a portfolio — <strong>talk to the system I built</strong>. Ask
              about projects, architecture decisions, or paste a job description for an instant
              fit score.
            </p>

            <div className="hero2-cta-row">
              <motion.button
                onClick={() => onStart()}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 450, damping: 22 }}
                className="hero2-cta"
              >
                Ask Ravinder
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.button>
              <span className="hero2-cta-hint">no login · no setup</span>
            </div>

            <div className="hero2-chips-row hero-chips">
              {FEATURED_QUESTIONS.map((q) => (
                <motion.button
                  key={q}
                  type="button"
                  onClick={() => onStart(q)}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className="hero-chip"
                >
                  {q}
                </motion.button>
              ))}
            </div>

            <div className="hero2-identity-row">
              <div className="hero2-portrait-wrap">
                <div className="hero2-portrait-glow" aria-hidden />
                <div className="hero2-portrait">
                  <Image src="/ravinder.jpg" alt="Ravinder Varikuppala" fill sizes="60px" style={{ objectFit: "cover" }} />
                </div>
              </div>
              <div className="hero2-identity-copy">
                <b>Shipping agentic AI systems</b> in production —<br />
                this page runs on one of them.
              </div>
            </div>
          </motion.div>

          {/* ── Live runtime graph carousel ──────────────────────────── */}
          <motion.div variants={itemVariants}>
            <GraphCarousel />
          </motion.div>
        </div>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="hero2-stats">
          {(profile?.stats ?? FALLBACK_STATS).map((s) => (
            <div key={s.label} className="hero2-stat">
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
