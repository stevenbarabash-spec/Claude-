"use client";
// Matrix-style digital rain, drawn on a fixed canvas behind the dashboard.
// Kept dim (muted greens on the page background) so panels stay readable;
// skipped entirely when the user prefers reduced motion.
import { useEffect, useRef } from "react";

const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789JARVIS$#*+<>";
const FONT_SIZE = 14;
const FRAME_MS = 72; // slow trickle

export function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Rain color follows the active theme's accent.
    let rgb = "111, 224, 174";
    const readColor = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb").trim();
      if (v) rgb = v;
    };
    readColor();
    window.addEventListener("theme:change", readColor);

    let w = 0;
    let h = 0;
    let drops: number[] = [];
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const cols = Math.ceil(w / FONT_SIZE);
      drops = Array.from({ length: cols }, () => Math.random() * (h / FONT_SIZE));
      ctx.fillStyle = "#060907";
      ctx.fillRect(0, 0, w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = 0;
    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      if (t - last < FRAME_MS) return;
      last = t;
      // fade the previous frame toward the page background → trailing streaks
      ctx.fillStyle = "rgba(6, 9, 7, 0.14)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${FONT_SIZE}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        ctx.fillStyle = Math.random() < 0.06 ? `rgba(${rgb}, 0.95)` : `rgba(${rgb}, 0.5)`;
        ctx.fillText(glyph, i * FONT_SIZE, drops[i] * FONT_SIZE);
        if (drops[i] * FONT_SIZE > h && Math.random() > 0.972) drops[i] = 0;
        drops[i]++;
      }
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("theme:change", readColor);
    };
  }, []);

  return <canvas ref={ref} className="matrix-rain" aria-hidden />;
}
