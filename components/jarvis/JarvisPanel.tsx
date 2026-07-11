"use client";
// Jarvis — floating assistant panel. Voice notes use the browser's speech
// recognition when available, else MediaRecorder → /api/jarvis/transcribe (Whisper).
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

interface Msg {
  role: "user" | "assistant";
  content: string;
  meta?: string;
}

const GREETING: Msg = {
  role: "assistant",
  content:
    "Online. Speak or type — I'll file tasks, meals, ideas and notes into the right place, or answer questions about your own data.\n\nTip: prefix with \"capture:\" or \"ask:\" to force a mode.",
};

export function JarvisPanel() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
  }, [msgs, open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const history = [...msgs, { role: "user" as const, content: trimmed }];
    setMsgs(history);
    setInput("");
    setBusy(true);
    try {
      const res = await api<{ reply: string; action?: { type: string; routed_to?: string } }>(
        "/api/jarvis/chat",
        { method: "POST", body: JSON.stringify({ messages: history.filter((m) => !m.meta || m.role === "user") }) },
      );
      const meta =
        res.action?.type === "capture"
          ? `filed → ${res.action.routed_to}`
          : res.action?.type === "ask"
            ? "from memory"
            : undefined;
      setMsgs((m) => [...m, { role: "assistant", content: res.reply, meta }]);
      window.dispatchEvent(new CustomEvent("jarvis:capture")); // let cards refresh
    } catch (err) {
      setMsgs((m) => [...m, { role: "assistant", content: `Something went wrong: ${String(err)}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function toggleVoice() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    // Preferred: browser speech recognition (free, instant).
    const SR =
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition ??
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.onresult = (e) => {
        const text = Array.from(e.results).map((r) => r[0].transcript).join(" ");
        setRecording(false);
        void send(text);
      };
      rec.onerror = () => setRecording(false);
      rec.onend = () => setRecording(false);
      recRef.current = rec;
      setRecording(true);
      rec.start();
      return;
    }
    // Fallback: record audio, transcribe with Whisper server-side.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob);
        setBusy(true);
        try {
          const res = await fetch("/api/jarvis/transcribe", { method: "POST", body: form });
          const data = await res.json();
          setBusy(false);
          if (data.text) void send(data.text);
          else setMsgs((m) => [...m, { role: "assistant", content: data.error ?? "Transcription failed." }]);
        } catch {
          setBusy(false);
        }
      };
      recRef.current = recorder;
      setRecording(true);
      recorder.start();
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Microphone unavailable." }]);
    }
  }

  return (
    <>
      {open && (
        <div className="jarvis-panel">
          <div className="jarvis-head">
            <span className="rail-brand">
              <span className="dot" />
              JARVIS
            </span>
            <span className="rule" style={{ flex: 1 }} />
            <button className="btn small" onClick={() => setOpen(false)}>
              close
            </button>
          </div>
          <div className="jarvis-msgs" ref={scrollRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`msg ${m.role === "user" ? "user" : "jarvis"}`}>
                {m.content}
                {m.meta && <div className="meta">{m.meta}</div>}
              </div>
            ))}
            {busy && <div className="msg jarvis faint">thinking…</div>}
          </div>
          <form
            className="jarvis-input"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <button type="button" className={`mic-btn ${recording ? "recording" : ""}`} onClick={toggleVoice} title="Voice capture">
              {recording ? "◼" : "🎙"}
            </button>
            <input
              className="input"
              placeholder={recording ? "Listening…" : "Talk to Jarvis…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button className="btn primary" disabled={busy || !input.trim()}>
              →
            </button>
          </form>
        </div>
      )}
      <button className="jarvis-fab" onClick={() => setOpen((o) => !o)} title="Jarvis">
        {open ? "×" : "J"}
      </button>
    </>
  );
}

// Minimal typing for the vendor-prefixed Web Speech API.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
