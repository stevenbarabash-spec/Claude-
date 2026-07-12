"use client";
// The little eye in a card header — click for a "How do I use this?" widget
// with three sections (what it does / how to use it / what it interacts with)
// and a Listen button that reads it aloud. Copy lives in lib/cardHelp.
import { useEffect, useRef, useState } from "react";
import { CARD_HELP, type CardHelp } from "@/lib/cardHelp";

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return (
    voices.find((v) => /en-GB/i.test(v.lang) && /daniel|arthur|male/i.test(v.name)) ??
    voices.find((v) => /daniel|arthur/i.test(v.name)) ??
    voices.find((v) => v.lang?.startsWith("en"))
  );
}

function spokenText(title: string, h: CardHelp): string {
  return [
    `${title}.`,
    `What it does. ${h.what}`,
    `How to use it. ${h.how.join(" ")}`,
    `What it works with. ${h.interacts.join(" ")}`,
  ].join(" ");
}

export function PanelHelp({ title }: { title: string }) {
  const help = CARD_HELP[title];
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Stop any narration when the widget closes or unmounts.
  useEffect(() => {
    if (!open && speaking) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
    }
  }, [open, speaking]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  if (!help) return null;

  function toggleSpeak() {
    if (!("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(spokenText(title, help!));
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1.02;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  return (
    <span className="panel-help" ref={ref}>
      <button
        className="panel-eye"
        onClick={() => setOpen((o) => !o)}
        aria-label={`How ${title} works`}
        title="How do I use this?"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      {open && (
        <span className="help-pop">
          <span className="help-head">
            <span className="help-title">{title}</span>
            <button className={`btn small ${speaking ? "primary" : ""}`} onClick={toggleSpeak}>
              {speaking ? "◼ stop" : "🔊 listen"}
            </button>
          </span>

          <span className="help-section">
            <span className="help-label">What it does</span>
            <span className="help-what">{help.what}</span>
          </span>

          <span className="help-section">
            <span className="help-label">How to use it</span>
            {help.how.map((h, i) => (
              <span key={i} className="help-bullet"><span className="help-dot">›</span><span>{h}</span></span>
            ))}
          </span>

          <span className="help-section">
            <span className="help-label">Works with</span>
            {help.interacts.map((h, i) => (
              <span key={i} className="help-bullet"><span className="help-dot">›</span><span>{h}</span></span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
