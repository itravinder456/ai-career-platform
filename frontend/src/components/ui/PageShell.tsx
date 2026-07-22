"use client";

import { motion } from "framer-motion";
import Navbar from "./Navbar";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function PageShell({
  eyebrow,
  title,
  subtitle,
  children,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** Tighter header spacing for utility screens (e.g. admin) that don't need
   * the same hero-style lead-in as a public landing page. */
  compact?: boolean;
}) {
  return (
    // overflow-x-hidden, matching Hero.tsx's own root: the ambient glow blobs
    // below are fixed-width (420-560px) and absolutely positioned by a `right`
    // percentage — on a narrow viewport they extend past the edge and inflate
    // document.documentElement.scrollWidth, causing a phantom horizontal
    // scroll on the whole page even though no *content* actually overflows.
    <div className="relative min-h-screen overflow-x-hidden dot-grid" style={{ background: "var(--bg)" }}>
      {/* Bottom vignette so the dot-grid fades rather than hard-cuts, same
          treatment as Hero.tsx */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 0%, transparent 40%, var(--bg) 100%)",
        }}
      />
      {/* Ambient copper/wire glow, same pair Hero.tsx uses — keeps these
          pages reading as the same system rather than a bolted-on section */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "4%",
          right: "8%",
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(107,138,148,0.12) 0%, transparent 68%)",
          filter: "blur(70px)",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "32%",
          left: "0%",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(201,122,61,0.08) 0%, transparent 68%)",
          filter: "blur(60px)",
        }}
      />

      <Navbar state="chat" />

      <div className="relative z-10" style={{ maxWidth: 1100, margin: "0 auto", padding: compact ? "76px 24px 60px" : "104px 24px 80px" }}>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="hero2-eyebrow">
            <span className="dot" />
            {eyebrow}
          </div>
          <h1
            style={{
              fontSize: "clamp(30px, 3.4vw, 42px)",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.015em",
            }}
          >
            {title}
          </h1>
          <p style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.6, color: "var(--text-secondary)", maxWidth: 560 }}>
            {subtitle}
          </p>
        </motion.div>

        <div style={{ marginTop: compact ? 24 : 44 }}>{children}</div>
      </div>
    </div>
  );
}
