"use client";
// Session card (mockup 02): greeting, live clock, "today I will", capture bar,
// and the Jarvis morning briefing.
import { useEffect, useRef, useState } from "react";
import { api, clientDateKey, debounce } from "@/lib/client";
import { config } from "@/lib/config";
import { quoteOfTheDay } from "@/lib/quotes";
import { Ticker } from "../Ticker";
import { Panel } from "../Panel";

function greeting(h: number): string {
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function Session() {
  const [now, setNow] = useState<Date | null>(null);
  const [focus, setFocus] = useState("");
  const [capture, setCapture] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const dirty = useRef(false); // don't let a slow mount GET clobber a fresh edit (guide §8.4)

  const saveFocus = useRef(
    debounce((value: string) => {
      void api(`/api/log/${clientDateKey()}`, { method: "POST", body: JSON.stringify({ focus: value }) });
    }, 600),
  ).current;

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    api<{ log: { notes: { focus?: string } } | null }>(`/api/log/${clientDateKey()}`)
      .then((r) => {
        if (!dirty.current) setFocus(r.log?.notes.focus ?? "");
      })
      .catch(() => {});
    api<{ briefing: string | null }>("/api/jarvis/briefing")
      .then((r) => setBriefing(r.briefing))
      .catch(() => {});
    return () => clearInterval(t);
  }, []);

  async function submitCapture(e: React.FormEvent) {
    e.preventDefault();
    const text = capture.trim();
    if (!text) return;
    setCapture("");
    try {
      const res = await api<{ reply: string }>("/api/capture", { method: "POST", body: JSON.stringify({ text }) });
      setToast(res.reply);
      window.dispatchEvent(new CustomEvent("jarvis:capture"));
    } catch (err) {
      setToast(`Capture failed: ${String(err)}`);
    }
    setTimeout(() => setToast(null), 4000);
  }

  const dateLine = now
    ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "";
  const quote = quoteOfTheDay(clientDateKey());

  return (
    <Panel idx="02" title="Session" right={<span suppressHydrationWarning>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="greeting" suppressHydrationWarning>
            {now ? greeting(now.getHours()) : "Hello"}, {config.owner.name}.
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 4, fontFamily: "var(--mono)", letterSpacing: "0.1em" }} suppressHydrationWarning>
            {dateLine.toUpperCase()}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="num" style={{ fontSize: 32, fontWeight: 500 }} suppressHydrationWarning>
            {now ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/ (AM|PM)/, "") : "--:--"}
            <span className="faint" style={{ fontSize: 15 }}>
              {" "}
              {now ? (now.getHours() >= 12 ? "PM" : "AM") : ""}
            </span>
          </div>
          <div className="label">Local time</div>
        </div>
      </div>

      {/* Live market + news ticker, right under the date */}
      <Ticker />

      <div className="panel" style={{ padding: 12, marginTop: 12, background: "var(--accent-dim)", borderColor: "rgba(111,224,174,0.2)" }}>
        <div className="label accent" style={{ marginBottom: 6 }}>Jarvis briefing</div>
        {briefing && <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{briefing}</div>}
        <div
          style={{
            marginTop: briefing ? 10 : 0,
            paddingTop: briefing ? 10 : 0,
            borderTop: briefing ? "1px solid var(--border-soft)" : "none",
            fontSize: 13,
            lineHeight: 1.6,
            fontStyle: "italic",
          }}
        >
          “{quote.text}”
          <span className="faint" style={{ fontStyle: "normal", fontSize: 11.5 }}> — {quote.who}</span>
        </div>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <span className="label" style={{ whiteSpace: "nowrap" }}>Today I will</span>
        <input
          className="input"
          placeholder="Set today's one thing…"
          value={focus}
          onChange={(e) => {
            dirty.current = true;
            setFocus(e.target.value);
            saveFocus(e.target.value);
          }}
        />
      </div>

      <form className="row" style={{ marginTop: 10 }} onSubmit={submitCapture}>
        <span className="label" style={{ whiteSpace: "nowrap" }}>⌘ Capture</span>
        <input
          className="input"
          placeholder="Anything — Jarvis will file it…"
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
        />
        <button className="btn primary" disabled={!capture.trim()}>Capture</button>
      </form>

      {toast && <div className="toast">{toast}</div>}
    </Panel>
  );
}
