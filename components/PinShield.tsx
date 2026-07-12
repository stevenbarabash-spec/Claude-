"use client";
// Privacy shield for money: content renders blurred + greyed until the PIN is
// entered. Optional auto-relock (home card); page-level shields relock on
// navigation automatically because unmounting resets state.
// Note: this is a shoulder-surfing shield, not cryptography — the dashboard
// password remains the real lock on the data.
import { useEffect, useRef, useState } from "react";

const PIN = "1782";

export function PinShield({
  children,
  autoLockMs,
  hint = "click to unlock",
}: {
  children: React.ReactNode;
  autoLockMs?: number;
  hint?: string;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function tryPin(value: string) {
    setPin(value);
    setError(false);
    if (value.length < 4) return;
    if (value === PIN) {
      setUnlocked(true);
      setPrompting(false);
      setPin("");
      if (autoLockMs) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setUnlocked(false), autoLockMs);
      }
    } else {
      setError(true);
      setPin("");
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div style={{ position: "relative" }}>
      <div
        aria-hidden
        style={{
          filter: "blur(9px) grayscale(0.85)",
          opacity: 0.5,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {children}
      </div>
      <div
        style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", cursor: "pointer" }}
        onClick={() => setPrompting(true)}
      >
        {prompting ? (
          <div onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              maxLength={4}
              className="input num"
              style={{ width: 120, textAlign: "center", letterSpacing: "0.45em", fontSize: 16 }}
              placeholder="PIN"
              value={pin}
              onChange={(e) => tryPin(e.target.value.replace(/\D/g, ""))}
            />
            <div style={{ fontSize: 11, marginTop: 6, color: error ? "var(--hot)" : "var(--text-faint)" }}>
              {error ? "wrong PIN" : "enter 4-digit PIN"}
            </div>
          </div>
        ) : (
          <span className="chip" style={{ padding: "6px 12px", fontSize: 10 }}>
            🔒 {hint}
          </span>
        )}
      </div>
    </div>
  );
}
