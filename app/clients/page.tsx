"use client";
// CLIENTS — the Command work board, rebuilt to match the original tracker:
// due-today-by-client strip, stacked project cards (fields row, strikethrough
// task lists, collapsible updates log), and a right sidebar with week strip,
// upcoming deadlines, and the master open-tasks checklist.
import { useEffect, useState } from "react";
import { UndoToast } from "@/components/UndoToast";
import { api, clientDateKey } from "@/lib/client";
import type { ClientProject, ClientTask } from "@/lib/types";

function clientOf(name: string): string {
  return name.split("—")[0].trim();
}

function daysLeft(date: string, today: string): number {
  return Math.round((new Date(date + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400000);
}

function shortDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${ap}` : `${h12} ${ap}`;
}

const STATUS_EDGE: Record<ClientProject["status"], string> = {
  done: "var(--accent)",
  active: "var(--warm)",
  paused: "var(--text-faint)",
};

export default function ClientsPage() {
  const [projects, setProjects] = useState<ClientProject[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  // Last checked-off task, so a stray click is one tap away from coming back.
  const [undo, setUndo] = useState<{ projectId: string; task: ClientTask } | null>(null);
  const today = clientDateKey();

  function load() {
    api<{ projects: ClientProject[] }>("/api/clients").then((r) => setProjects(r.projects)).catch(() => {});
  }
  useEffect(load, []);

  async function patch(id: string, body: Partial<ClientProject>) {
    setProjects((ps) => (ps ?? []).map((p) => (p.id === id ? { ...p, ...body } : p)));
    await api(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify(body) }).catch(load);
    window.dispatchEvent(new CustomEvent("jarvis:capture"));
  }

  function setTaskDone(projectId: string, task: ClientTask, done: boolean) {
    const p = projects?.find((x) => x.id === projectId);
    if (!p) return;
    void patch(p.id, { tasks: p.tasks.map((t) => (t.id === task.id ? { ...t, done } : t)) });
  }

  function toggleTask(p: ClientProject, task: ClientTask) {
    const nowDone = !task.done;
    setTaskDone(p.id, task, nowDone);
    // Only checking OFF hides the row — that's the click worth an undo.
    setUndo(nowDone ? { projectId: p.id, task } : null);
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await api("/api/clients", { method: "POST", body: JSON.stringify({ name: newName.trim() }) });
    setNewName("");
    setAdding(false);
    load();
  }

  if (projects === null) return <div className="faint">Loading…</div>;

  const active = projects.filter((p) => p.status === "active");
  // Open tasks across ALL projects — a done project can still have loose ends.
  const openTasks = projects.flatMap((p) => p.tasks.filter((t) => !t.done).map((t) => ({ p, t })));
  const doneTasks = projects.flatMap((p) => p.tasks.filter((t) => t.done).map((t) => ({ p, t })));
  const overdueCount = openTasks.filter(({ t }) => t.due && t.due < today).length;

  // Due today, grouped by client (project deadlines included).
  const dueTodayByClient = new Map<string, { title: string; overdue: boolean }[]>();
  for (const p of projects) {
    if (p.status === "done") continue;
    const c = clientOf(p.name);
    for (const t of p.tasks) {
      if (t.done || !t.due) continue;
      if (t.due === today) dueTodayByClient.set(c, [...(dueTodayByClient.get(c) ?? []), { title: t.title, overdue: false }]);
      else if (t.due < today) dueTodayByClient.set(c, [...(dueTodayByClient.get(c) ?? []), { title: t.title, overdue: true }]);
    }
    if (p.deadline === today) {
      dueTodayByClient.set(c, [...(dueTodayByClient.get(c) ?? []), { title: "PROJECT DEADLINE", overdue: false }]);
    }
  }

  const deadlines = active
    .filter((p) => p.deadline && p.deadline >= today)
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1));

  const sortedOpen = [...openTasks].sort((a, b) => {
    if (a.t.due && b.t.due) return a.t.due < b.t.due ? -1 : 1;
    if (a.t.due) return -1;
    if (b.t.due) return 1;
    return 0;
  });

  // This-week strip, Sunday-first like the original.
  const week: { key: string; date: Date }[] = [];
  const sunday = new Date(today + "T12:00:00");
  sunday.setDate(sunday.getDate() - sunday.getDay());
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(d.getDate() + i);
    week.push({ key: clientDateKey(d), date: d });
  }

  const dateLine = new Date(today + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const dueChip = (t: ClientTask) => (
    <span
      className="num"
      style={{
        fontSize: 10,
        flexShrink: 0,
        color: t.due && t.due < today ? "var(--hot)" : t.due === today ? "var(--warm)" : "var(--text-faint)",
      }}
    >
      {t.due ? shortDate(t.due) : "est. date"}
    </span>
  );

  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* ── Header ── */}
      <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="row">
          <span className="label" style={{ fontSize: 12, color: "var(--text)" }}>COMMAND</span>
          <span className="faint" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>{dateLine}</span>
          {adding ? (
            <form className="row" onSubmit={addProject}>
              <input className="input" style={{ width: 260 }} placeholder="Client — Project name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              <button className="btn primary">Add</button>
              <button type="button" className="btn" onClick={() => setAdding(false)}>cancel</button>
            </form>
          ) : (
            <button className="btn small" onClick={() => setAdding(true)}>+ new project</button>
          )}
        </div>
        <div className="row" style={{ gap: 18 }}>
          {(
            [
              [active.length, "Active"],
              [overdueCount, "Urgent"],
              [openTasks.length, "Open tasks"],
            ] as const
          ).map(([n, label]) => (
            <div key={label} style={{ textAlign: "right" }}>
              <div className="num" style={{ fontSize: 18, color: label === "Urgent" && n > 0 ? "var(--hot)" : undefined }}>{n}</div>
              <div className="label" style={{ fontSize: 9.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Due today by client ── */}
      {dueTodayByClient.size > 0 && (
        <div>
          <div className="label" style={{ color: "var(--warm)", marginBottom: 8 }}>
            Due today by client · {new Date(today + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </div>
          <div className="row" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
            {[...dueTodayByClient.entries()].map(([client, items]) => (
              <div key={client} className="panel" style={{ padding: 12, minWidth: 200, borderColor: items.some((i) => i.overdue) ? "rgba(224,112,111,0.4)" : "rgba(224,194,111,0.35)" }}>
                <div className="spread">
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{client}</span>
                  <span className="num faint" style={{ fontSize: 11 }}>{items.length}</span>
                </div>
                {items.map((i, idx) => (
                  <div key={idx} style={{ marginTop: 7, fontSize: 12, background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "6px 8px" }}>
                    {i.title}
                    <div className="label" style={{ fontSize: 9.5, marginTop: 3, color: i.overdue ? "var(--hot)" : "var(--warm)" }}>
                      {i.overdue ? "overdue" : "due today"}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>
        {/* Projects column */}
        <div className="stack" style={{ gap: 14 }}>
          <div className="label">Projects</div>
          {projects.map((p, idx) => (
            <ProjectCard key={p.id} p={p} idx={idx} today={today} allProjects={projects} onPatch={(b) => patch(p.id, b)} onToggleTask={(t) => toggleTask(p, t)} onReload={load} />
          ))}
          {projects.length === 0 && <div className="panel faint" style={{ textAlign: "center", padding: 30 }}>No projects yet.</div>}
        </div>

        {/* Sidebar */}
        <div className="stack" style={{ gap: 16, position: "sticky", top: 60 }}>
          <div className="panel" style={{ padding: 12 }}>
            <div className="label" style={{ marginBottom: 8 }}>This week</div>
            <div className="row" style={{ gap: 4 }}>
              {week.map(({ key, date }) => (
                <div
                  key={key}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "7px 2px",
                    borderRadius: 7,
                    border: "1px solid",
                    borderColor: key === today ? "rgba(111,224,174,0.5)" : "var(--border-soft)",
                    background: key === today ? "var(--accent-dim)" : "transparent",
                  }}
                >
                  <div className="label" style={{ fontSize: 9 }}>{date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</div>
                  <div className="num" style={{ fontSize: 13, marginTop: 2, color: key === today ? "var(--accent)" : undefined }}>{date.getDate()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: 12 }}>
            <div className="label" style={{ marginBottom: 8 }}>Upcoming deadlines</div>
            <div className="stack" style={{ gap: 8 }}>
              {deadlines.map((p) => (
                <div key={p.id} className="spread">
                  <span className="row" style={{ gap: 7, fontSize: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--accent)", flexShrink: 0 }} />
                    {p.name}
                  </span>
                  <span className="chip" style={{ flexShrink: 0 }}>{daysLeft(p.deadline!, today)}d left</span>
                </div>
              ))}
              {deadlines.length === 0 && <div className="faint" style={{ fontSize: 12 }}>None set.</div>}
            </div>
          </div>

          <div className="panel" style={{ padding: 12 }}>
            <div className="label" style={{ marginBottom: 8 }}>Open tasks</div>
            <div className="stack" style={{ gap: 4 }}>
              {sortedOpen.map(({ p, t }) => (
                <div key={t.id} className="row" style={{ alignItems: "flex-start", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border-soft)" }}>
                  <input type="checkbox" checked={false} onChange={() => toggleTask(p, t)} style={{ marginTop: 2, accentColor: "var(--accent)", cursor: "pointer" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.4 }}>{t.title}</div>
                    <div className="label" style={{ fontSize: 9, marginTop: 2 }}>{clientOf(p.name)}</div>
                  </div>
                  {dueChip(t)}
                </div>
              ))}
              {doneTasks.slice(0, 30).map(({ p, t }) => (
                <div key={t.id} className="row" style={{ alignItems: "flex-start", gap: 8, padding: "5px 0", opacity: 0.35 }}>
                  <input type="checkbox" checked onChange={() => toggleTask(p, t)} style={{ marginTop: 2, accentColor: "var(--accent)", cursor: "pointer" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.4, textDecoration: "line-through" }}>{t.title}</div>
                    <div className="label" style={{ fontSize: 9, marginTop: 2 }}>{clientOf(p.name)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {undo && (
        <UndoToast
          label={`Marked done: ${undo.task.title}`}
          onUndo={() => setTaskDone(undo.projectId, undo.task, false)}
          onExpire={() => setUndo(null)}
        />
      )}
    </div>
  );
}

/* ── Project card ─────────────────────────────────────── */
function ProjectCard({
  p,
  idx,
  today,
  allProjects,
  onPatch,
  onToggleTask,
  onReload,
}: {
  p: ClientProject;
  idx: number;
  today: string;
  allProjects: ClientProject[];
  onPatch: (body: Partial<ClientProject>) => void;
  onToggleTask: (t: ClientTask) => void;
  onReload: () => void;
}) {
  const [showUpdates, setShowUpdates] = useState(false);
  const [editing, setEditing] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [dueEditId, setDueEditId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({ title: "", due: "" });
  const [newNote, setNewNote] = useState("");

  function setTaskDue(taskId: string, due: string) {
    onPatch({ tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, due: due || null } : t)) });
  }

  function setTaskTime(taskId: string, time: string) {
    onPatch({ tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, time: time || null } : t)) });
  }

  async function moveTask(taskId: string, toProjectId: string) {
    setMovingId(null);
    await api("/api/clients/move", {
      method: "POST",
      body: JSON.stringify({ taskId, fromProjectId: p.id, toProjectId }),
    }).catch(() => {});
    window.dispatchEvent(new CustomEvent("jarvis:capture"));
    onReload();
  }
  const [form, setForm] = useState({
    name: p.name,
    phase: p.phase ?? "",
    deadline: p.deadline ?? "",
    next_milestone: p.next_milestone ?? "",
    budget: p.budget ?? "",
    progress: String(p.progress),
  });

  const doneCount = p.tasks.filter((t) => t.done).length;

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTask.title.trim();
    if (!title) return;
    onPatch({ tasks: [...p.tasks, { id: crypto.randomUUID(), title, done: false, due: newTask.due || null }] });
    setNewTask({ title: "", due: "" });
  }

  function addNote(e: React.FormEvent) {
    e.preventDefault();
    const note = newNote.trim();
    if (!note) return;
    onPatch({ iterations: [...p.iterations, { date: today, note }] });
    setNewNote("");
  }

  async function remove() {
    if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    await api(`/api/clients/${p.id}`, { method: "DELETE" });
    onReload();
  }

  const field = (label: string, value: string | null) =>
    value ? (
      <div>
        <div className="label" style={{ fontSize: 9.5 }}>{label}</div>
        <div style={{ fontSize: 12, fontFamily: "var(--mono)", marginTop: 3, lineHeight: 1.45 }}>{value}</div>
      </div>
    ) : null;

  return (
    <div className="panel" style={{ borderLeft: `2px solid ${STATUS_EDGE[p.status]}`, opacity: p.status === "done" ? 0.7 : 1 }}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
          <div className="label" style={{ fontSize: 9.5, marginTop: 3 }}>PRJ-{String(idx + 1).padStart(3, "0")}</div>
        </div>
        <span className={`chip ${p.status === "done" ? "ok" : p.status === "active" ? "ok" : "warm"}`} style={p.status === "active" ? { background: "var(--accent-dim)" } : undefined}>
          {p.status}
        </span>
      </div>

      <div className="row" style={{ marginTop: 10, gap: 10 }}>
        <div className="bar" style={{ flex: 1, height: 4 }}>
          <div style={{ width: `${p.progress}%`, background: STATUS_EDGE[p.status] }} />
        </div>
        <span className="num faint" style={{ fontSize: 11 }}>{p.progress}%</span>
      </div>

      <div className="row" style={{ marginTop: 12, gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        {p.deadline && field("Deadline", `${shortDate(p.deadline)} · ${daysLeft(p.deadline, today)}d left`)}
        {field("Phase", p.phase)}
        {field("Next milestone", p.next_milestone)}
        {field("Budget", p.budget)}
      </div>

      {/* Tasks */}
      <div style={{ marginTop: 14 }}>
        <div className="label" style={{ fontSize: 9.5, marginBottom: 6 }}>
          Tasks · {doneCount}/{p.tasks.length} done
        </div>
        <div className="stack" style={{ gap: 3 }}>
          {p.tasks.map((t) => (
            <div key={t.id} style={{ position: "relative" }}>
              <div className="row" style={{ gap: 8, cursor: "pointer", padding: "2px 0" }} onClick={() => onToggleTask(t)}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    flexShrink: 0,
                    border: `1px solid ${t.done ? "var(--accent)" : "var(--text-faint)"}`,
                    background: t.done ? "var(--accent)" : "transparent",
                  }}
                />
                <span
                  style={{
                    fontSize: 12.5,
                    flex: 1,
                    textDecoration: t.done ? "line-through" : "none",
                    color: t.done ? "var(--text-faint)" : "var(--text)",
                  }}
                >
                  {t.title}
                </span>
                <button
                  className="num"
                  title="Change due date"
                  style={{
                    fontSize: 10,
                    flexShrink: 0,
                    background: "transparent",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 5,
                    padding: "1px 6px",
                    cursor: "pointer",
                    color: t.due ? (t.due < today ? "var(--hot)" : t.due === today ? "var(--warm)" : "var(--text-faint)") : "var(--text-faint)",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDueEditId(dueEditId === t.id ? null : t.id);
                  }}
                >
                  {t.due ? shortDate(t.due) : "＋ due date"}
                  {t.time ? ` · ${fmtClock(t.time)}` : ""}
                </button>
                <button
                  className="btn small"
                  title="Move to another project"
                  style={{ padding: "1px 6px", fontSize: 11, lineHeight: 1.4, flexShrink: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMovingId(movingId === t.id ? null : t.id);
                  }}
                >
                  ⇄
                </button>
              </div>
              {dueEditId === t.id && (
                <div
                  className="panel row"
                  style={{ position: "absolute", right: 0, top: "100%", zIndex: 70, padding: 8, gap: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    className="input"
                    type="date"
                    autoFocus
                    defaultValue={t.due ?? ""}
                    style={{ padding: "5px 9px", fontSize: 12 }}
                    onChange={(e) => setTaskDue(t.id, e.target.value)}
                    title="Due date"
                  />
                  <input
                    className="input"
                    type="time"
                    defaultValue={t.time ?? ""}
                    style={{ padding: "5px 9px", fontSize: 12, width: 110 }}
                    onChange={(e) => setTaskTime(t.id, e.target.value)}
                    title="Time (optional)"
                  />
                  <button className="btn small primary" onClick={() => setDueEditId(null)}>done</button>
                  {(t.due || t.time) && (
                    <button className="btn small" style={{ color: "var(--hot)" }} onClick={() => { setTaskDue(t.id, ""); setTaskTime(t.id, ""); }}>
                      clear
                    </button>
                  )}
                </div>
              )}
              {movingId === t.id && (
                <div
                  className="panel"
                  style={{ position: "absolute", right: 0, top: "100%", zIndex: 70, padding: 6, minWidth: 200, maxHeight: 240, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
                >
                  <div className="label" style={{ fontSize: 9.5, padding: "2px 6px 6px" }}>Move to…</div>
                  {allProjects.filter((x) => x.id !== p.id).length === 0 ? (
                    <div className="faint" style={{ fontSize: 11, padding: "4px 6px" }}>No other projects.</div>
                  ) : (
                    allProjects
                      .filter((x) => x.id !== p.id)
                      .map((x) => (
                        <button
                          key={x.id}
                          className="row"
                          style={{ width: "100%", textAlign: "left", gap: 8, padding: "6px 6px", fontSize: 12, background: "transparent", border: "none", cursor: "pointer", color: "var(--text)", borderRadius: 5 }}
                          onClick={() => moveTask(t.id, x.id)}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: 3, flexShrink: 0, background: STATUS_EDGE[x.status] }} />
                          {x.name}
                        </button>
                      ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <form className="row" style={{ marginTop: 8 }} onSubmit={addTask}>
          <input className="input" style={{ flex: 2, padding: "5px 9px", fontSize: 12 }} placeholder="+ add task…" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
          <input className="input" type="date" style={{ width: 145, padding: "5px 9px", fontSize: 12 }} value={newTask.due} onChange={(e) => setNewTask({ ...newTask, due: e.target.value })} />
          <button className="btn small">+</button>
        </form>
      </div>

      {/* Updates */}
      <button className="label" style={{ marginTop: 12, fontSize: 9, cursor: "pointer" }} onClick={() => setShowUpdates(!showUpdates)}>
        {showUpdates ? "▼" : "▶"} {p.iterations.length} updates
      </button>
      {showUpdates && (
        <div className="stack" style={{ gap: 7, marginTop: 8 }}>
          {[...p.iterations].reverse().map((it, i) => (
            <div key={i} style={{ fontSize: 12, lineHeight: 1.55 }}>
              <span className="num faint" style={{ fontSize: 10 }}>{it.date}</span> <span className="dim">{it.note}</span>
            </div>
          ))}
          <form className="row" onSubmit={addNote}>
            <input className="input" style={{ flex: 1, padding: "5px 9px", fontSize: 12 }} placeholder="Add an update…" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            <button className="btn small">log</button>
          </form>
          <div className="row">
            {editing ? null : <button className="btn small" onClick={() => setEditing(true)}>✎ edit project</button>}
            {p.status !== "done" ? (
              <button className="btn small" onClick={() => onPatch({ status: "done", progress: 100 })}>mark done</button>
            ) : (
              <button className="btn small" onClick={() => onPatch({ status: "active" })}>reopen</button>
            )}
            <span style={{ flex: 1 }} />
            <button className="btn small" style={{ color: "var(--hot)" }} onClick={remove}>delete</button>
          </div>
          {editing && (
            <div className="stack">
              <div className="grid-2">
                <label><span className="label" style={{ fontSize: 9.5 }}>Name</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label><span className="label" style={{ fontSize: 9.5 }}>Phase</span><input className="input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} /></label>
                <label><span className="label" style={{ fontSize: 9.5 }}>Deadline</span><input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label>
                <label><span className="label" style={{ fontSize: 9.5 }}>Progress %</span><input className="input num" type="number" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })} /></label>
                <label><span className="label" style={{ fontSize: 9.5 }}>Next milestone</span><input className="input" value={form.next_milestone} onChange={(e) => setForm({ ...form, next_milestone: e.target.value })} /></label>
                <label><span className="label" style={{ fontSize: 9.5 }}>Budget</span><input className="input" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></label>
              </div>
              <div className="row">
                <button
                  className="btn primary"
                  onClick={() => {
                    onPatch({
                      name: form.name.trim() || p.name,
                      phase: form.phase.trim() || null,
                      deadline: form.deadline || null,
                      next_milestone: form.next_milestone.trim() || null,
                      budget: form.budget.trim() || null,
                      progress: Math.max(0, Math.min(100, Number(form.progress) || 0)),
                    });
                    setEditing(false);
                  }}
                >
                  Save
                </button>
                <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
