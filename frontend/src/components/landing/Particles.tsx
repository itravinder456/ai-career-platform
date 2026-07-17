"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseOpacity: number;
  hue: number;
  depth: number; // 0.35 (far) .. 1 (near) — drives size, parallax, connection weight
  twinklePhase: number;
  twinkleSpeed: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number; // 1 -> 0
}

const COUNT = 110;
const CONNECT_DIST = 150;
const MOUSE_REPEL = 110;
const PARALLAX = 26; // px of drift at full depth across the viewport

export default function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  // Normalized mouse offset from center, -1..1, for parallax.
  const parallaxRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      parallaxRef.current = {
        x: (e.clientX / W - 0.5) * 2,
        y: (e.clientY / H - 0.5) * 2,
      };
    };
    window.addEventListener("mousemove", onMouse);

    const particles: Particle[] = Array.from({ length: COUNT }, () => {
      const depth = 0.35 + Math.random() * 0.65;
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.24 * depth,
        vy: (Math.random() - 0.5) * 0.24 * depth,
        size: (Math.random() * 1.4 + 0.5) * depth,
        baseOpacity: (Math.random() * 0.45 + 0.18) * depth,
        hue: Math.random() < 0.6 ? 260 : Math.random() < 0.5 ? 282 : 232,
        depth,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.6 + Math.random() * 1.1,
      };
    });

    const shootingStars: ShootingStar[] = [];
    let raf = 0;
    let t = 0;

    const spawnShootingStar = () => {
      const fromLeft = Math.random() < 0.5;
      const y = Math.random() * H * 0.5;
      const speed = 9 + Math.random() * 6;
      const angle = (Math.random() * 0.35 + 0.15) * (fromLeft ? 1 : -1);
      shootingStars.push({
        x: fromLeft ? -40 : W + 40,
        y,
        vx: (fromLeft ? 1 : -1) * speed,
        vy: speed * angle,
        len: 90 + Math.random() * 70,
        life: 1,
      });
    };

    const drawStatic = () => {
      // Reduced-motion: draw a calm field once, no animation.
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 75%, 76%, ${p.baseOpacity})`;
        ctx.fill();
      }
    };

    if (reduceMotion) {
      drawStatic();
      return () => {
        window.removeEventListener("resize", resize);
        window.removeEventListener("mousemove", onMouse);
      };
    }

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      const { x: mx, y: my } = mouseRef.current;
      const px = parallaxRef.current.x;
      const py = parallaxRef.current.y;

      // Compute rendered positions (base + drift + parallax) once for reuse in connections.
      const rx: number[] = new Array(particles.length);
      const ry: number[] = new Array(particles.length);
      const ro: number[] = new Array(particles.length);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Gentle mouse repel on the near layers.
        const dx = p.x - mx;
        const dy = p.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < MOUSE_REPEL && d > 0) {
          const force = ((MOUSE_REPEL - d) / MOUSE_REPEL) * p.depth;
          p.vx += (dx / d) * force * 0.05;
          p.vy += (dy / d) * force * 0.05;
        }

        p.vx *= 0.99;
        p.vy *= 0.99;
        const spd = Math.hypot(p.vx, p.vy);
        const cap = 0.8 * p.depth;
        if (spd > cap) {
          p.vx = (p.vx / spd) * cap;
          p.vy = (p.vy / spd) * cap;
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
        if (p.x > W) { p.x = W; p.vx = -Math.abs(p.vx); }
        if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
        if (p.y > H) { p.y = H; p.vy = -Math.abs(p.vy); }

        const twinkle = 0.62 + 0.38 * Math.sin(t * p.twinkleSpeed + p.twinklePhase);
        const drawX = p.x + px * PARALLAX * p.depth;
        const drawY = p.y + py * PARALLAX * p.depth;
        const opacity = p.baseOpacity * twinkle;
        rx[i] = drawX;
        ry[i] = drawY;
        ro[i] = opacity;

        ctx.beginPath();
        ctx.arc(drawX, drawY, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 78%, 78%, ${opacity})`;
        ctx.fill();
      }

      // Constellation links (tinted, weighted by depth).
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = rx[i] - rx[j];
          const dy = ry[i] - ry[j];
          const dist = Math.hypot(dx, dy);
          if (dist < CONNECT_DIST) {
            const near = (particles[i].depth + particles[j].depth) * 0.5;
            const alpha = 0.11 * (1 - dist / CONNECT_DIST) * near;
            ctx.beginPath();
            ctx.moveTo(rx[i], ry[i]);
            ctx.lineTo(rx[j], ry[j]);
            ctx.strokeStyle = `rgba(160, 130, 250, ${alpha})`;
            ctx.lineWidth = 0.55;
            ctx.stroke();
          }
        }
      }

      // Occasional shooting star (~ every 7–13s).
      if (Math.random() < 0.0022 && shootingStars.length < 2) spawnShootingStar();
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.012;
        if (s.life <= 0 || s.x < -80 || s.x > W + 80) {
          shootingStars.splice(i, 1);
          continue;
        }
        const tailX = s.x - (s.vx / Math.hypot(s.vx, s.vy)) * s.len;
        const tailY = s.y - (s.vy / Math.hypot(s.vx, s.vy)) * s.len;
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(220, 210, 255, ${0.9 * s.life})`);
        grad.addColorStop(1, "rgba(160, 130, 250, 0)");
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(235, 228, 255, ${s.life})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
}
