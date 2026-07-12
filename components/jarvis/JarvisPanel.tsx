"use client";
// Jarvis — floating assistant panel with full voice conversation.
// Voice in: browser speech recognition (Whisper fallback via /api/jarvis/transcribe).
// Voice out: browser speech synthesis. Voice mode chains them: listen → answer
// aloud → listen again, hands-free.
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
    "Online. Speak or type — I'll file tasks, meals, money and notes into the right place, or answer questions about your own data.\n\nTap the headset for hands-free voice mode.",
};

export function JarvisPanel() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // Set when Jarvis has read a capture back and is waiting on confirm/cancel.
  const [proposal, setProposal] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const voiceModeRef = useRef(false);
  const lastInputWasVoice = useRef(false);
  const openRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
  }, [msgs, open]);

  useEffect(() => {
    openRef.current = open;
    if (!open) stopVoiceMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ── Voice out ── */
  function pickVoice(): SpeechSynthesisVoice | undefined {
    const voices = window.speechSynthesis?.getVoices() ?? [];
    return (
      voices.find((v) => /en-GB/i.test(v.lang) && /daniel|arthur|male/i.test(v.name)) ??
      voices.find((v) => /daniel|arthur/i.test(v.name)) ??
      voices.find((v) => v.lang?.startsWith("en") && /google uk english male/i.test(v.name)) ??
      voices.find((v) => v.lang?.startsWith("en"))
    );
  }

  function speak(text: string, onDone?: () => void) {
    if (!("speechSynthesis" in window)) {
      onDone?.();
      return;
    }
    try {
      // Strip citation markers and cap length so replies stay listenable.
      const clean = text.replace(/\[\d+\]/g, "").replace(/[*_#`]/g, "").slice(0, 800);
      const u = new SpeechSynthesisUtterance(clean);
      const voice = pickVoice();
      if (voice) u.voice = voice;
      u.rate = 1.03;
      u.pitch = 0.95;
      setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        onDone?.();
      };
      u.onerror = () => {
        setSpeaking(false);
        onDone?.();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
      onDone?.();
    }
  }

  /* ── Chat ── */
  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const spoken = lastInputWasVoice.current;
    lastInputWasVoice.current = false;
    const history = [...msgs, { role: "user" as const, content: trimmed }];
    setMsgs(history);
    setInput("");
    setBusy(true);
    setProposal(null);
    try {
      const res = await api<{ reply: string; action?: { type: string; routed_to?: string; proposal_text?: string } }>(
        "/api/jarvis/chat",
        { method: "POST", body: JSON.stringify({ messages: history }) },
      );
      const meta =
        res.action?.type === "capture"
          ? `filed → ${res.action.routed_to}`
          : res.action?.type === "capture_proposed"
            ? "awaiting your confirm"
            : res.action?.type === "ask"
              ? "from memory"
              : undefined;
      setMsgs((m) => [...m, { role: "assistant", content: res.reply, meta }]);
      if (res.action?.type === "capture_proposed") setProposal(res.action.proposal_text ?? "");
      window.dispatchEvent(new CustomEvent("jarvis:capture")); // let cards refresh
      if (spoken || voiceModeRef.current) {
        speak(res.reply, () => {
          // Hands-free loop: after Jarvis finishes talking, listen again.
          if (voiceModeRef.current && openRef.current) startListening();
        });
      }
    } catch (err) {
      setMsgs((m) => [...m, { role: "assistant", content: `Something went wrong: ${String(err)}` }]);
    } finally {
      setBusy(false);
    }
  }

  /* ── Voice in ── */
  function getRecognizer(): SpeechRecognitionLike | null {
    const SR =
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition ??
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition;
    return SR ? new SR() : null;
  }

  function startListening() {
    if (recording || busy) return;
    const rec = getRecognizer();
    if (rec) {
      // Continuous mode + a silence window: keep listening while the user
      // talks (pauses included) and only send after ~2s of quiet — so Jarvis
      // waits for the whole thought instead of firing on the first pause.
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      let transcript = "";
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;
      let sent = false;
      const finish = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        try {
          rec.stop();
        } catch {}
      };
      rec.onresult = (e) => {
        transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ").replace(/\s+/g, " ").trim();
        setInput(transcript); // live read-along while speaking
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(finish, 2000);
      };
      let fatal = false;
      rec.onerror = (e) => {
        // "no-speech" just means a quiet room — everything else kills the loop.
        if (e?.error !== "no-speech" && e?.error !== "aborted") fatal = true;
      };
      // onend always fires (after onerror too) — the single place we act.
      rec.onend = () => {
        setRecording(false);
        if (silenceTimer) clearTimeout(silenceTimer);
        if (sent) return;
        sent = true;
        setInput("");
        if (fatal) {
          stopVoiceMode();
          return;
        }
        if (transcript.trim()) {
          lastInputWasVoice.current = true;
          void send(transcript);
        } else if (voiceModeRef.current && openRef.current) {
          // heard nothing — keep the hands-free loop alive
          setTimeout(() => startListening(), 400);
        }
      };
      recRef.current = rec;
      setRecording(true);
      rec.start();
      return;
    }
    void recordAndTranscribe();
  }

  async function recordAndTranscribe() {
    // Fallback for browsers without native speech recognition: Whisper server-side.
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
          if (data.text) {
            lastInputWasVoice.current = true;
            void send(data.text);
          } else {
            setMsgs((m) => [...m, { role: "assistant", content: data.error ?? "Transcription failed." }]);
          }
        } catch {
          setBusy(false);
        }
      };
      recRef.current = recorder;
      setRecording(true);
      recorder.start();
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Microphone unavailable." }]);
      stopVoiceMode();
    }
  }

  function toggleMic() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    startListening();
  }

  /* ── Hands-free voice mode ── */
  function toggleVoiceMode() {
    if (voiceModeRef.current) {
      stopVoiceMode();
      return;
    }
    voiceModeRef.current = true;
    setVoiceMode(true);
    // A user gesture is required before speech synthesis works on mobile —
    // this toggle IS the gesture, so prime it with a short confirmation.
    speak("Voice mode on.", () => {
      if (voiceModeRef.current && openRef.current) startListening();
    });
  }

  function stopVoiceMode() {
    voiceModeRef.current = false;
    setVoiceMode(false);
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    recRef.current?.stop();
    setSpeaking(false);
  }

  return (
    <>
      {open && (
        <div className="jarvis-panel">
          <div className="jarvis-head">
            <span className="rail-brand">
              <span className="dot" style={speaking ? { boxShadow: "0 0 14px var(--accent)" } : undefined} />
              JARVIS
            </span>
            {voiceMode && <span className="chip ok">{speaking ? "speaking" : recording ? "listening" : "voice"}</span>}
            <span style={{ flex: 1 }} />
            <button
              className={`btn small ${voiceMode ? "primary" : ""}`}
              onClick={toggleVoiceMode}
              title="Hands-free voice conversation"
            >
              🎧 voice
            </button>
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
            {proposal !== null && !busy && (
              <div className="row" style={{ gap: 8, alignSelf: "flex-start", flexWrap: "wrap" }}>
                <button className="btn small primary" onClick={() => void send("confirm")}>
                  ✓ confirm
                </button>
                <button
                  className="btn small"
                  onClick={() => {
                    setInput(proposal);
                    setProposal(null);
                  }}
                >
                  ✎ edit
                </button>
                <button className="btn small" style={{ color: "var(--hot)" }} onClick={() => void send("cancel")}>
                  ✕ cancel
                </button>
              </div>
            )}
          </div>
          <form
            className="jarvis-input"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <button type="button" className={`mic-btn ${recording ? "recording" : ""}`} onClick={toggleMic} title="Voice capture">
              {recording ? "◼" : "🎙"}
            </button>
            <input
              className="input"
              placeholder={recording ? "Listening…" : voiceMode ? "Voice mode — just talk…" : "Talk to Jarvis…"}
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
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
