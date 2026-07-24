"use client";
// Matrix-style digital rain, drawn on a fixed canvas.
// Default (dashboard background): kept dim so panels stay readable.
// `intense` (the PIN / lock screen): bright, glowing, digit-heavy rain where
// each falling glyph flares like a firework as it trickles down.
// Skipped entirely when the user prefers reduced motion.
import { useEffect, useRef } from "react";

const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789JARVIS$#*+<>";
const DIGITS = "0123456789";
const FONT_SIZE = 14;

export function MatrixRain({ intense = false }: { intense?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Rain color follows the active theme's accent; `bright` is a lightened
    // version used for the glowing heads in intense mode.
    let rgb = "111, 224, 174";
    let bright = "191, 255, 214";
    let rainBg = "6, 9, 7"; // canvas base — themes may relight it (white/light)
    const readColor = () => {
      const cs = getComputedStyle(document.documentElement);
      const v = cs.getPropertyValue("--accent-rgb").trim();
      if (v) rgb = v;
      const bg = cs.getPropertyValue("--rain-bg").trim();
      if (bg) rainBg = bg;
      bright = rgb
        .split(",")
        .map((n) => Math.min(255, parseInt(n, 10) + 90))
        .join(", ");
    };
    readColor();
    window.addEventListener("theme:change", readColor);

    const FRAME_MS = intense ? 58 : 72; // intense trickles a touch faster
    const FADE = intense ? 0.085 : 0.14; // slower fade → longer, brighter trails

    let w = 0;
    let h = 0;
    let drops: number[] = [];
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const cols = Math.ceil(w / FONT_SIZE);
      drops = Array.from({ length: cols }, () => Math.random() * (h / FONT_SIZE));
      ctx.fillStyle = `rgb(${rainBg})`;
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
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(${rainBg}, ${FADE})`;
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${FONT_SIZE}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        if (intense) {
          // Mostly digits, so it reads as bright numbers cascading down.
          const set = Math.random() < 0.82 ? DIGITS : GLYPHS;
          const glyph = set[Math.floor(Math.random() * set.length)];
          const firework = Math.random() < 0.05; // occasional white flare
          ctx.shadowColor = firework ? "rgba(255, 255, 255, 0.95)" : `rgba(${rgb}, 0.95)`;
          ctx.shadowBlur = firework ? 24 : 14;
          ctx.fillStyle = firework ? "rgba(255, 255, 255, 0.98)" : `rgba(${bright}, 0.95)`;
          ctx.fillText(glyph, i * FONT_SIZE, drops[i] * FONT_SIZE);
        } else {
          const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          ctx.fillStyle = Math.random() < 0.06 ? `rgba(${rgb}, 0.95)` : `rgba(${rgb}, 0.5)`;
          ctx.fillText(glyph, i * FONT_SIZE, drops[i] * FONT_SIZE);
        }
        if (drops[i] * FONT_SIZE > h && Math.random() > 0.972) drops[i] = 0;
        drops[i]++;
      }
      ctx.shadowBlur = 0;
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("theme:change", readColor);
    };
  }, [intense]);

  return <canvas ref={ref} className={`matrix-rain${intense ? " matrix-rain-intense" : ""}`} aria-hidden />;
}
