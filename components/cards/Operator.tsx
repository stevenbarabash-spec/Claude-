"use client";
import { useEffect, useState } from "react";
import { api, clientDateKey } from "@/lib/client";
import { config } from "@/lib/config";
import { Panel } from "../Panel";

export function Operator() {
  const [focus, setFocus] = useState<string>("");
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const today = clientDateKey();
    api<{ log: { notes: { focus?: string } } | null }>(`/api/log/${today}`)
      .then((r) => setFocus(r.log?.notes.focus ?? ""))
      .catch(() => {});
    // Streak = consecutive days (ending yesterday or today) with ≥1 habit done.
    api<{ habits: { date: string; done: string[] }[] }>("/api/habits?days=60")
      .then((r) => {
        const byDate = new Map(r.habits.map((h) => [h.date, h.done.length]));
        let s = 0;
        const d = new Date();
        if (!byDate.get(clientDateKey(d))) d.setDate(d.getDate() - 1); // today not required yet
        while ((byDate.get(clientDateKey(d)) ?? 0) > 0) {
          s++;
          d.setDate(d.getDate() - 1);
        }
        setStreak(s);
      })
      .catch(() => {});
    const onCapture = () => {
      api<{ log: { notes: { focus?: string } } | null }>(`/api/log/${clientDateKey()}`)
        .then((r) => setFocus(r.log?.notes.focus ?? ""))
        .catch(() => {});
    };
    window.addEventListener("jarvis:capture", onCapture);
    return () => window.removeEventListener("jarvis:capture", onCapture);
  }, []);

  return (
    <Panel idx="01" title="Operator" right={<span className="chip ok">online</span>}>
      <div className="row" style={{ gap: 12 }}>
        <div className="rail-avatar" style={{ width: 44, height: 44, fontSize: 14 }}>
          {config.owner.name[0]}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{config.owner.fullName}</div>
          <div className="faint" style={{ fontSize: 12 }}>
            {config.owner.role} · {config.owner.location}
          </div>
        </div>
      </div>
      <div className="divider" />
      <div className="spread">
        <div>
          <div className="label">Focus</div>
          <div className="dim" style={{ fontSize: 13, marginTop: 4, fontStyle: focus ? "normal" : "italic" }}>
            {focus || "not set — use the Session card"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="label">Streak</div>
          <div className="num" style={{ fontSize: 22, marginTop: 2 }}>
            <span className="accent">{streak}</span> <span className="faint" style={{ fontSize: 11 }}>DAYS</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}
