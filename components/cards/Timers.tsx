"use client";
// Timers — one-tap countdowns (1m…1h) that ring like an alarm clock when
// they hit zero. Several can run at once; each shows a live countdown and
// can be cancelled. The beeper uses Web Audio, primed by the click itself.
import { useEffect, useRef, useState } from "react";
import { Panel } from "../Panel";

const PRESETS: { label: string; minutes: number }[] = [
  { label: "1m", minutes: 1 },
  { label: "2m", minutes: 2 },
  { label: "5m", minutes: 5 },
  { label: "10m", minutes: 10 },
  { label: "20m", minutes: 20 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
];

interface RunningTimer {
  id: string;
  label: string;
  endsAt: number; // epoch ms
  done: boolean;
}

function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export function Timers() {
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [, setTick] = useState(0); // re-render heartbeat while timers run
  const audioRef = useRef<AudioContext | null>(null);
  const beepingRef = useRef<Set<string>>(new Set());

  // Restore running timers after a refresh.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("jarvis-timers") ?? "[]") as RunningTimer[];
      setTimers(saved.filter((t) => !t.done && t.endsAt > Date.now()));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("jarvis-timers", JSON.stringify(timers));
    } catch {}
  }, [timers]);

  // Heartbeat + ring detection.
  useEffect(() => {
    if (timers.length === 0) return;
    const iv = setInterval(() => {
      setTick((n) => n + 1);
      setTimers((ts) =>
        ts.map((t) => {
          if (!t.done && t.endsAt <= Date.now()) {
            startRinging(t.id);
            return { ...t, done: true };
          }
          return t;
        }),
      );
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timers.length]);

  function ensureAudio(): AudioContext | null {
    try {
      if (!audioRef.current) {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        audioRef.current = new Ctx();
      }
      void audioRef.current.resume();
      return audioRef.current;
    } catch {
      return null;
    }
  }

  function beepOnce(ctx: AudioContext) {
    // Two quick alarm pips.
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.22 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.2);
    }
  }

  function startRinging(id: string) {
    if (beepingRef.current.has(id)) return;
    beepingRef.current.add(id);
    const ctx = ensureAudio();
    const ring = () => {
      if (!beepingRef.current.has(id)) return;
      if (ctx) beepOnce(ctx);
      setTimeout(ring, 1000);
    };
    ring();
    // Auto-silence after 60s so a missed alarm doesn't beep forever.
    setTimeout(() => beepingRef.current.delete(id), 60000);
  }

  function start(minutes: number, label: string) {
    ensureAudio(); // user gesture primes audio for the later ring
    setTimers((ts) => [
      ...ts,
      { id: crypto.randomUUID(), label, endsAt: Date.now() + minutes * 60000, done: false },
    ]);
  }

  function dismiss(id: string) {
    beepingRef.current.delete(id);
    setTimers((ts) => ts.filter((t) => t.id !== id));
  }

  return (
    <Panel idx="12" title="Timers" right={timers.length > 0 ? <span>{timers.filter((t) => !t.done).length} running</span> : undefined}>
      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
        {PRESETS.map((p) => (
          <button key={p.label} className="btn small" onClick={() => start(p.minutes, p.label)}>
            {p.label}
          </button>
        ))}
      </div>

      {timers.length > 0 && (
        <div className="stack" style={{ gap: 6, marginTop: 12 }}>
          {timers.map((t) => {
            const left = t.endsAt - Date.now();
            return (
              <div
                key={t.id}
                className="spread"
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1px solid ${t.done ? "var(--hot)" : "var(--border-soft)"}`,
                  background: t.done ? "var(--hot-dim)" : "rgba(255,255,255,0.015)",
                  animation: t.done ? "pulse 1.2s infinite" : undefined,
                }}
              >
                <span className="row" style={{ gap: 8 }}>
                  <span className="chip">{t.label}</span>
                  <span className="num" style={{ fontSize: 15, color: t.done ? "var(--hot)" : "var(--accent)" }}>
                    {t.done ? "TIME'S UP" : fmtLeft(left)}
                  </span>
                </span>
                <button className="btn small" onClick={() => dismiss(t.id)}>
                  {t.done ? "dismiss" : "cancel"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
