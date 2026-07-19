"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RuntimeGraph from "./RuntimeGraph";
import { TOPOLOGIES } from "@/lib/graphTopologies";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const ROTATE_MS = 9000;

// Cycles through the three real system topologies, sliding one out and the
// next in once each has had time to finish a couple of its own path loops —
// the panel frame (border/glow/blur) stays put; only the content card slides.
export default function GraphCarousel() {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const restart = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % TOPOLOGIES.length), ROTATE_MS);
  };

  useEffect(() => {
    restart();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const topo = TOPOLOGIES[index];

  const goTo = (i: number) => {
    setIndex(i);
    restart(); // manual pick resets the clock so it doesn't jump right after
  };

  return (
    <div className="graph-panel">
      <AnimatePresence mode="wait">
        <motion.div
          key={topo.id}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -28 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <div className="graph-panel-head">
            <div className="graph-title">{topo.title}</div>
            <div className="graph-live">
              <span className="dot" />
              LIVE
            </div>
          </div>
          <div className="graph-canvas-wrap">
            <RuntimeGraph nodes={topo.nodes} edges={topo.edges} paths={topo.paths} />
          </div>
          <div className="graph-caption">{topo.caption}</div>
        </motion.div>
      </AnimatePresence>

      <div className="graph-dots">
        {TOPOLOGIES.map((t, i) => (
          <button
            key={t.id}
            type="button"
            className={`graph-dot${i === index ? " active" : ""}`}
            aria-label={`Show ${t.id.replace(/_/g, " ")} topology`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
