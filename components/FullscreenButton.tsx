"use client";
// Fullscreen toggle — pinned to the bottom-right of the lock screen. Tapping it
// takes the browser in/out of fullscreen (kiosk-style), and the icon flips to
// match the current state.
import { useEffect, useState } from "react";

export function FullscreenButton() {
  const [isFull, setIsFull] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof document !== "undefined" && !!document.documentElement.requestFullscreen);
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* user gesture / permission issues — nothing to do */
    }
  }

  if (!supported) return null;

  return (
    <button
      className="fullscreen-btn"
      onClick={toggle}
      title={isFull ? "Exit fullscreen" : "Go fullscreen"}
      aria-label={isFull ? "Exit fullscreen" : "Go fullscreen"}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>⛶</span>
      <span>{isFull ? "Exit fullscreen" : "Fullscreen"}</span>
    </button>
  );
}
