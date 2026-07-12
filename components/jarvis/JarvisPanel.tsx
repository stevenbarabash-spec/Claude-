"use client";
// Jarvis — floating assistant panel with full voice conversation.
// Voice in: browser speech recognition (Whisper fallback via /api/jarvis/transcribe),
// with a live mic soundwave so you can SEE it hearing you and a Submit button.
// Voice out: browser speech synthesis. Voice mode chains them hands-free.
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

interface Msg {
  role: "user" | "assistant";
  content: string;
  meta?: string;
}

const BARS = 20;

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
  const [listening, setListening] = useState(false); // a mic session is open
  const [voiceMode, setVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState(""); // live transcript while listening
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [proposal, setProposal] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRecognitionLike | { stop: () => void } | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; raf: number; stream: MediaStream } | null>(null);
  const voiceModeRef = useRef(false);
  const lastInputWasVoice = useRef(false);
  const openRef = useRef(false);
  // Session state, decoupled from recognition's flaky onend lifecycle.
  const sessionRef = useRef(false); // is a listening session active?
  const submittingRef = useRef(false); // guard against double-submit
  const committedRef = useRef(""); // finalized text across recognition restarts
  const liveRef = useRef(""); // current recognition instance's text
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
  }, [msgs, open]);

  useEffect(() => {
    openRef.current = open;
    if (!open) stopVoiceMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ── Live mic soundwave (best-effort; independent of transcription) ── */
  function startAnalyser(stream: MediaStream) {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let last = 0;
      const loop = (t: number) => {
        const raf = requestAnimationFrame(loop);
        if (audioRef.current) audioRef.current.raf = raf;
        if (t - last < 45) return;
        last = t;
        analyser.getByteFrequencyData(data);
        const bars = Array.from({ length: BARS }, (_, i) => {
          const idx = Math.floor((i / BARS) * data.length);
          return Math.min(1, (data[idx] / 255) * 1.6);
        });
        setLevels(bars);
      };
      const raf = requestAnimationFrame(loop);
      audioRef.current = { ctx, raf, stream };
    } catch {
      /* soundwave is optional */
    }
  }

  function stopAudio() {
    const a = audioRef.current;
    if (a) {
      cancelAnimationFrame(a.raf);
      a.stream.getTracks().forEach((t) => t.stop());
      a.ctx.close().catch(() => {});
      audioRef.current = null;
    }
    setLevels(Array(BARS).fill(0));
  }

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
    setInterim("");
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
      window.dispatchEvent(new CustomEvent("jarvis:capture"));
      if (spoken || voiceModeRef.current) {
        speak(res.reply, () => {
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

  function heardSoFar(): string {
    return `${committedRef.current} ${liveRef.current}`.replace(/\s+/g, " ").trim();
  }

  // Start a listening SESSION: opens the mic + soundwave and keeps it open,
  // restarting the recognizer underneath if it drops, until you submit.
  async function startListening() {
    if (listening || busy) return;
    committedRef.current = "";
    liveRef.current = "";
    submittingRef.current = false;
    setInterim("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startAnalyser(stream);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "I can't reach the microphone — check the browser's mic permission for this site." }]);
      return;
    }
    sessionRef.current = true;
    setListening(true);
    if (getRecognizer()) startRecognition();
    // If there's no native recognition, the session still shows the soundwave;
    // tapping Submit records+transcribes via Whisper (needs OPENAI_API_KEY).
  }

  function startRecognition() {
    const rec = getRecognizer();
    if (!rec) return;
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    liveRef.current = "";
    rec.onresult = (e) => {
      liveRef.current = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setInterim(heardSoFar());
      if (silenceRef.current) clearTimeout(silenceRef.current);
      // Auto-submit after ~1.8s of quiet once we've actually heard something.
      silenceRef.current = setTimeout(() => submitSession(), 1800);
    };
    // getUserMedia (in startListening) is the real mic-permission gate, so any
    // recognition error here is non-fatal: onend restarts it, the soundwave and
    // Submit button stay live, and Submit always works as a manual fallback.
    rec.onerror = () => {};
    rec.onend = () => {
      // Recognition drops often (silence/timeouts). Keep the session alive by
      // committing what we heard and restarting — this is the "not responding" fix.
      if (!sessionRef.current || submittingRef.current) return;
      committedRef.current = heardSoFar();
      liveRef.current = "";
      setTimeout(() => {
        if (sessionRef.current && !submittingRef.current) startRecognition();
      }, 400);
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* start() can throw if called too soon after stop(); onend will retry */
    }
  }

  // Finalize the session and send what was heard.
  async function submitSession() {
    if (!sessionRef.current || submittingRef.current) return;
    submittingRef.current = true;
    sessionRef.current = false;
    if (silenceRef.current) clearTimeout(silenceRef.current);
    const text = heardSoFar();
    try {
      recRef.current?.stop();
    } catch {}
    stopAudio();
    setListening(false);
    setInterim("");

    if (text) {
      lastInputWasVoice.current = true;
      void send(text);
      return;
    }
    // Nothing heard via native recognition → try Whisper on a short recording.
    if (!getRecognizer()) {
      void recordAndTranscribe();
    } else if (voiceModeRef.current && openRef.current) {
      setTimeout(() => startListening(), 300); // heard nothing, keep the loop
    }
  }

  function endSession() {
    sessionRef.current = false;
    submittingRef.current = false;
    if (silenceRef.current) clearTimeout(silenceRef.current);
    try {
      recRef.current?.stop();
    } catch {}
    stopAudio();
    setListening(false);
    setInterim("");
  }

  async function recordAndTranscribe() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
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
            setMsgs((m) => [...m, { role: "assistant", content: data.error ?? "Voice-to-text isn't available on this browser — it needs an OpenAI key (OPENAI_API_KEY). You can type instead." }]);
          }
        } catch {
          setBusy(false);
        }
      };
      recRef.current = recorder;
      recorder.start();
      setTimeout(() => { try { recorder.stop(); } catch {} }, 4000);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Microphone unavailable." }]);
    }
  }

  function toggleMic() {
    if (listening) submitSession();
    else void startListening();
  }

  /* ── Hands-free voice mode ── */
  function toggleVoiceMode() {
    if (voiceModeRef.current) {
      stopVoiceMode();
      return;
    }
    voiceModeRef.current = true;
    setVoiceMode(true);
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
    endSession();
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
            {voiceMode && <span className="chip ok">{speaking ? "speaking" : listening ? "listening" : "voice"}</span>}
            <span style={{ flex: 1 }} />
            <button className={`btn small ${voiceMode ? "primary" : ""}`} onClick={toggleVoiceMode} title="Hands-free voice conversation">
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
                <button className="btn small primary" onClick={() => void send("confirm")}>✓ confirm</button>
                <button className="btn small" onClick={() => { setInput(proposal); setProposal(null); }}>✎ edit</button>
                <button className="btn small" style={{ color: "var(--hot)" }} onClick={() => void send("cancel")}>✕ cancel</button>
              </div>
            )}
          </div>

          {/* Live listening panel — soundwave + heard text + Submit */}
          {listening && (
            <div className="voice-live">
              <div className="voice-viz">
                {levels.map((v, i) => (
                  <span key={i} className="voice-bar" style={{ height: `${8 + v * 34}px`, opacity: 0.4 + v * 0.6 }} />
                ))}
              </div>
              <div className="voice-heard">{interim || "Listening… speak now"}</div>
              <button className="btn small primary" onClick={submitSession}>submit ⏎</button>
            </div>
          )}

          <form className="jarvis-input" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
            <button type="button" className={`mic-btn ${listening ? "recording" : ""}`} onClick={toggleMic} title={listening ? "Submit" : "Voice capture"}>
              {listening ? "◼" : "🎙"}
            </button>
            <input
              className="input"
              placeholder={listening ? "Listening…" : voiceMode ? "Voice mode — just talk…" : "Talk to Jarvis…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy || listening}
            />
            <button className="btn primary" disabled={busy || !input.trim()}>→</button>
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
