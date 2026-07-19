"use client";

import { useEffect, useRef } from "react";

// Mirrors the actual LangGraph topology in services/runtime/app/graphs/career.py —
// classify_intent fans out to per-intent retrieval nodes, all converging on respond.
// This is deliberately the real graph, not a generic decorative diagram.
interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
}

const NODES: Node[] = [
  { id: "start", label: "start", x: 0.08, y: 0.5, r: 5 },
  { id: "classify", label: "classify_intent", x: 0.34, y: 0.5, r: 7 },
  { id: "project", label: "project", x: 0.64, y: 0.12, r: 6 },
  { id: "skills", label: "skills", x: 0.64, y: 0.37, r: 6 },
  { id: "resume", label: "resume", x: 0.64, y: 0.62, r: 6 },
  { id: "jd_match", label: "jd_match", x: 0.64, y: 0.87, r: 6 },
  { id: "respond", label: "respond", x: 0.92, y: 0.5, r: 7 },
];

const EDGES: [string, string][] = [
  ["start", "classify"],
  ["classify", "project"],
  ["classify", "skills"],
  ["classify", "resume"],
  ["classify", "jd_match"],
  ["project", "respond"],
  ["skills", "respond"],
  ["resume", "respond"],
  ["jd_match", "respond"],
];

const PATHS: string[][] = [
  ["start", "classify", "project", "respond"],
  ["start", "classify", "skills", "respond"],
  ["start", "classify", "resume", "respond"],
  ["start", "classify", "jd_match", "respond"],
];

function bezierPoint(
  t: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
) {
  const u = 1 - t;
  const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
  const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
  return { x, y };
}

export default function RuntimeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    const css = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();

    let W = 0;
    let H = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const pad = 30;
    const pos = (n: Node) => ({
      x: pad + n.x * (W - pad * 2),
      y: pad + n.y * (H - pad * 2),
    });
    const byId = (id: string) => NODES.find((n) => n.id === id)!;

    let raf = 0;
    let activePath = 0;
    let pulseProgress = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      const wire = css("--wire");
      const wireBright = css("--wire-bright");
      const copper = css("--copper-bright");
      const border = css("--hero-line-bright");
      const muted = css("--hero-muted");
      const techFont = css("--font-tech") || "monospace";

      // All edges, quiet.
      ctx.lineWidth = 1;
      ctx.strokeStyle = border;
      for (const [a, b] of EDGES) {
        const pa = pos(byId(a));
        const pb = pos(byId(b));
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.bezierCurveTo(pa.x + (pb.x - pa.x) * 0.5, pa.y, pa.x + (pb.x - pa.x) * 0.5, pb.y, pb.x, pb.y);
        ctx.stroke();
      }

      const path = PATHS[activePath];
      const segLen = 1 / (path.length - 1);
      const segIndex = Math.min(Math.floor(pulseProgress / segLen), path.length - 2);
      const segT = (pulseProgress - segIndex * segLen) / segLen;

      // Traveled portion of the active path, brighter.
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = wireBright;
      for (let i = 0; i < segIndex; i++) {
        const a = pos(byId(path[i]));
        const b = pos(byId(path[i + 1]));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.bezierCurveTo(a.x + (b.x - a.x) * 0.5, a.y, a.x + (b.x - a.x) * 0.5, b.y, b.x, b.y);
        ctx.stroke();
      }
      const pa = pos(byId(path[segIndex]));
      const pb = pos(byId(path[segIndex + 1]));
      const cx1 = pa.x + (pb.x - pa.x) * 0.5;
      const cy1 = pa.y;
      const cx2 = pa.x + (pb.x - pa.x) * 0.5;
      const cy2 = pb.y;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, pb.x, pb.y);
      ctx.stroke();

      // Pulse dot.
      const pulse = reduceMotion
        ? { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
        : bezierPoint(segT, pa.x, pa.y, cx1, cy1, cx2, cy2, pb.x, pb.y);
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = copper;
      ctx.shadowColor = copper;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Nodes + labels.
      for (const n of NODES) {
        const p = pos(n);
        const onActive = path.includes(n.id);
        ctx.beginPath();
        ctx.arc(p.x, p.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = css("--ink");
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = onActive ? wireBright : wire;
        ctx.stroke();

        ctx.font = `10px ${techFont}`;
        ctx.fillStyle = muted;
        ctx.globalAlpha = 0.85;
        ctx.textAlign = n.x > 0.8 ? "right" : n.x < 0.2 ? "left" : "center";
        const ly = n.y < 0.3 ? p.y - n.r - 8 : p.y + n.r + 14;
        ctx.fillText(n.label, p.x, ly);
        ctx.globalAlpha = 1;
      }
    };

    if (reduceMotion) {
      draw();
      return () => window.removeEventListener("resize", resize);
    }

    const tick = () => {
      pulseProgress += 0.012;
      if (pulseProgress >= 1) {
        pulseProgress = 0;
        activePath = (activePath + 1) % PATHS.length;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}
