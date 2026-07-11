"use client";
// Weekly review (mockup page 4): six prompts + next week's top 3, auto-saved,
// sealed when done. Stored on the Monday anchor of the current week.
import { useEffect, useRef, useState } from "react";
import { api, clientDateKey, debounce } from "@/lib/client";
import type { WeeklyReview } from "@/lib/types";

const FIELDS: { key: keyof Omit<WeeklyReview, "sealed" | "next_top3">; label: string }[] = [
  { key: "wins", label: "Wins this week" },
  { key: "slipped", label: "What slipped" },
  { key: "open_loops", label: "Open loops" },
  { key: "follow_ups", label: "People to follow up with" },
  { key: "content_shipped", label: "Content shipped" },
  { key: "health_pattern", label: "Health pattern" },
];

function weekNumber(): number {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function ReviewPage() {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [anchor, setAnchor] = useState("");
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    api<{ anchor: string; review: WeeklyReview }>(`/api/review?week=${clientDateKey()}`)
      .then((r) => {
        setReview(r.review);
        setAnchor(r.anchor);
      })
      .catch(() => {});
  }, []);

  const persist = useRef(
    debounce((r: WeeklyReview) => {
      void api("/api/review", { method: "POST", body: JSON.stringify({ week: clientDateKey(), review: r }) }).then(() =>
        setSaved(true),
      );
    }, 800),
  ).current;

  function update(patch: Partial<WeeklyReview>) {
    if (!review) return;
    const next = { ...review, ...patch };
    setReview(next);
    setSaved(false);
    persist(next);
  }

  if (!review) return <div className="faint">Loading…</div>;

  const sundayLabel = anchor
    ? new Date(new Date(anchor + "T12:00:00").getTime() + 6 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";
  const mondayLabel = anchor
    ? new Date(anchor + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div className="panel">
        <div className="spread">
          <div>
            <div className="label">Weekly Review · W{weekNumber()}</div>
            <div className="greeting" style={{ marginTop: 8 }}>
              Mon {mondayLabel} <span className="faint">⟶</span> Sun {sundayLabel}
            </div>
          </div>
          <div className="row">
            <span className="faint" style={{ fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.1em" }}>
              {saved ? "AUTO-SAVED" : "SAVING…"}
            </span>
            <button
              className={`btn ${review.sealed ? "" : "primary"}`}
              onClick={() => update({ sealed: !review.sealed })}
            >
              {review.sealed ? "✓ Sealed" : "Seal week"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 16 }}>
        {FIELDS.map((f) => (
          <div key={f.key} className="panel">
            <div className="label" style={{ marginBottom: 8 }}>{f.label}</div>
            <textarea
              className="input"
              style={{ border: "none", background: "transparent", padding: 0 }}
              value={review[f.key]}
              disabled={review.sealed}
              onChange={(e) => update({ [f.key]: e.target.value } as Partial<WeeklyReview>)}
              placeholder="…"
            />
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="label" style={{ marginBottom: 8 }}>Next week — Top 3</div>
        <textarea
          className="input"
          style={{ border: "none", background: "transparent", padding: 0, fontSize: 15 }}
          value={review.next_top3}
          disabled={review.sealed}
          onChange={(e) => update({ next_top3: e.target.value })}
          placeholder="1) …  2) …  3) …"
        />
      </div>
    </div>
  );
}
