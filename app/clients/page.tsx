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

// Total tracked time on a task, in seconds → "1h 20m" / "45m" / "3m".
function totalSpentSec(t: ClientTask): number {
  return (t.sessions ?? []).reduce((s, x) => s + Math.max(0, (new Date(x.end).getTime() - new Date(x.start).getTime()) / 1000), 0);
}
function fmtSpent(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
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
  // Inline edit state for a "due today by client" strip item.
  const [stripEdit, setStripEdit] = useState<{ id: string; title: string; due: string } | null>(null);
  const today = clientDateKey();

  // Map of ref ("client:<taskId>") → the day-task id it created, for tasks
  // already on today's Section 10 — so the board can show them as added.
  const [todayRefs, setTodayRefs] = useState<Record<string, string>>({});
  function loadToday() {
    api<{ tasks: { id: string; ref?: string }[] }>(`/api/daytasks?date=${clientDateKey()}`)
      .then((r) => {
        const m: Record<string, string> = {};
        for (const t of r.tasks) if (t.ref && t.ref.startsWith("client:")) m[t.ref] = t.id;
        setTodayRefs(m);
      })
      .catch(() => {});
  }

  function load() {
    api<{ projects: ClientProject[] }>("/api/clients").then((r) => setProjects(r.projects)).catch(() => {});
  }
  useEffect(() => {
    load();
    loadToday();
    const onCap = () => loadToday();
    window.addEventListener("jarvis:capture", onCap);
    return () => window.removeEventListener("jarvis:capture", onCap);
  }, []);

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

  // ── Inline edit/delete for the "Due today by client" strip ──
  function stripDelete(projectId: string, taskId: string) {
    const p = projects?.find((x) => x.id === projectId);
    if (!p) return;
    void patch(projectId, { tasks: p.tasks.filter((t) => t.id !== taskId) });
    setStripEdit(null);
  }
  function stripSaveEdit(projectId: string, taskId: string) {
    const p = projects?.find((x) => x.id === projectId);
    if (!p || !stripEdit) return;
    void patch(projectId, {
      tasks: p.tasks.map((t) =>
        t.id === taskId ? { ...t, title: stripEdit.title.trim() || t.title, due: stripEdit.due || null } : t,
      ),
    });
    setStripEdit(null);
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

  // Due today, grouped by client (project deadlines included). Each item carries
  // its project + task id so the strip can check off / edit / delete inline.
  type DueItem = { title: string; overdue: boolean; projectId: string; task: ClientTask | null };
  const dueTodayByClient = new Map<string, DueItem[]>();
  for (const p of projects) {
    if (p.status === "done") continue;
    const c = clientOf(p.name);
    for (const t of p.tasks) {
      if (t.done || !t.due) continue;
      if (t.due <= today) {
        dueTodayByClient.set(c, [...(dueTodayByClient.get(c) ?? []), { title: t.title, overdue: t.due < today, projectId: p.id, task: t }]);
      }
    }
    if (p.deadline === today) {
      dueTodayByClient.set(c, [...(dueTodayByClient.get(c) ?? []), { title: "PROJECT DEADLINE", overdue: false, projectId: p.id, task: null }]);
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
                {items.map((i, idx) => {
                  const editing = i.task && stripEdit?.id === i.task.id;
                  return (
                    <div key={idx} style={{ marginTop: 7, fontSize: 12, background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "6px 8px" }}>
                      {editing && i.task ? (
                        <div className="stack" style={{ gap: 5 }}>
                          <input className="input" style={{ padding: "4px 7px", fontSize: 12 }} value={stripEdit!.title} autoFocus onChange={(e) => setStripEdit({ ...stripEdit!, title: e.target.value })} />
                          <div className="row" style={{ gap: 5 }}>
                            <input className="input" type="date" style={{ padding: "3px 6px", fontSize: 11 }} value={stripEdit!.due} onChange={(e) => setStripEdit({ ...stripEdit!, due: e.target.value })} />
                            <button className="btn small primary" onClick={() => stripSaveEdit(i.projectId, i.task!.id)}>save</button>
                            <button className="btn small" onClick={() => setStripEdit(null)}>×</button>
                          </div>
                        </div>
                      ) : (
                        <div className="row" style={{ gap: 7, alignItems: "flex-start" }}>
                          {i.task && (
                            <input
                              type="checkbox"
                              checked={false}
                              title="Mark done (syncs everywhere)"
                              onChange={() => setTaskDone(i.projectId, i.task!, true)}
                              style={{ marginTop: 2, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0 }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div>{i.title}</div>
                            <div className="label" style={{ fontSize: 9.5, marginTop: 3, color: i.overdue ? "var(--hot)" : "var(--warm)" }}>
                              {i.title === "PROJECT DEADLINE" ? "deadline" : i.overdue ? "overdue" : "due today"}
                            </div>
                          </div>
                          {i.task && (
                            <span className="row" style={{ gap: 3, flexShrink: 0 }}>
                              <button className="btn small" style={{ padding: "0 6px" }} title="Edit" onClick={() => setStripEdit({ id: i.task!.id, title: i.task!.title, due: i.task!.due ?? "" })}>✎</button>
                              <button className="btn small" style={{ padding: "0 6px", color: "var(--hot)" }} title="Delete" onClick={() => stripDelete(i.projectId, i.task!.id)}>×</button>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="clients-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16, alignItems: "start" }}>
        {/* Projects column */}
        <div className="stack" style={{ gap: 14 }}>
          <div className="label">Projects</div>
          {projects.map((p, idx) => (
            <ProjectCard key={p.id} p={p} idx={idx} today={today} allProjects={projects} todayRefs={todayRefs} onReloadToday={loadToday} onPatch={(b) => patch(p.id, b)} onToggleTask={(t) => toggleTask(p, t)} onReload={load} />
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
  todayRefs,
  onReloadToday,
  onPatch,
  onToggleTask,
  onReload,
}: {
  p: ClientProject;
  idx: number;
  today: string;
  allProjects: ClientProject[];
  todayRefs: Record<string, string>;
  onReloadToday: () => void;
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
  const [showRepeat, setShowRepeat] = useState(false);
  const [rec, setRec] = useState<{ title: string; cadence: "weekly" | "monthly"; weekdays: number[]; dayOfMonth: string; time: string }>({
    title: "",
    cadence: "weekly",
    weekdays: [],
    dayOfMonth: "1",
    time: "",
  });

  function addRecurring() {
    const title = rec.title.trim();
    if (!title) return;
    if (rec.cadence === "weekly" && rec.weekdays.length === 0) return;
    const def =
      rec.cadence === "weekly"
        ? { id: crypto.randomUUID(), title, cadence: "weekly" as const, weekdays: [...rec.weekdays].sort(), time: rec.time || null }
        : { id: crypto.randomUUID(), title, cadence: "monthly" as const, dayOfMonth: Math.max(1, Math.min(31, Number(rec.dayOfMonth) || 1)), time: rec.time || null };
    onPatch({ recurring: [...(p.recurring ?? []), def] });
    setRec({ title: "", cadence: rec.cadence, weekdays: [], dayOfMonth: "1", time: "" });
  }

  function removeRecurring(id: string) {
    onPatch({ recurring: (p.recurring ?? []).filter((r) => r.id !== id) });
  }

  function setTaskDue(taskId: string, due: string) {
    onPatch({ tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, due: due || null } : t)) });
  }

  function setTaskTime(taskId: string, time: string) {
    onPatch({ tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, time: time || null } : t)) });
  }

  // Toggle a task on/off today's Section 10. Green ✓ when already added.
  async function toggleToday(t: ClientTask) {
    const ref = `client:${t.id}`;
    const existingId = todayRefs[ref];
    if (existingId) {
      await api("/api/daytasks", {
        method: "DELETE",
        body: JSON.stringify({ date: clientDateKey(), id: existingId }),
      }).catch(() => {});
    } else {
      await api("/api/daytasks", {
        method: "POST",
        body: JSON.stringify({ date: clientDateKey(), title: `${t.title} · ${clientOf(p.name)}`, time: t.time ?? null, ref }),
      }).catch(() => {});
    }
    onReloadToday();
    window.dispatchEvent(new CustomEvent("jarvis:capture"));
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
                    minWidth: 0,
                    overflowWrap: "anywhere",
                    lineHeight: 1.4,
                    textDecoration: t.done ? "line-through" : "none",
                    color: t.done ? "var(--text-faint)" : "var(--text)",
                  }}
                >
                  {t.title}
                </span>
                {(t.sessions?.length ?? 0) > 0 && (
                  <span
                    className="num"
                    title={`Time tracked across ${t.sessions!.length} session${t.sessions!.length === 1 ? "" : "s"}`}
                    style={{ fontSize: 10, flexShrink: 0, color: "var(--accent)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    ⏱ {fmtSpent(totalSpentSec(t))}
                  </span>
                )}
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
                {(() => {
                  const onToday = Boolean(todayRefs[`client:${t.id}`]);
                  return (
                    <button
                      className="btn small"
                      title={onToday ? "On today's tasks — click to remove" : "Add to today's tasks (Section 10)"}
                      style={{
                        padding: "1px 7px",
                        fontSize: 11,
                        lineHeight: 1.4,
                        flexShrink: 0,
                        color: onToday ? "var(--accent)" : undefined,
                        borderColor: onToday ? "var(--accent)" : undefined,
                        background: onToday ? "var(--accent-dim)" : undefined,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleToday(t);
                      }}
                    >
                      {onToday ? "✓ today" : "＋ today"}
                    </button>
                  );
                })()}
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

        {/* Recurring tasks */}
        <button className="label" style={{ marginTop: 10, fontSize: 9, cursor: "pointer" }} onClick={() => setShowRepeat(!showRepeat)}>
          {showRepeat ? "▼" : "▶"} 🔁 {(p.recurring ?? []).length} repeating
        </button>
        {showRepeat && (
          <div className="stack" style={{ gap: 6, marginTop: 6 }}>
            {(p.recurring ?? []).map((r) => (
              <div key={r.id} className="spread" style={{ fontSize: 11.5 }}>
                <span>
                  {r.cadence === "weekly"
                    ? `Weekly · ${(r.weekdays ?? []).map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}`
                    : `Monthly · day ${r.dayOfMonth}`}
                  {r.time ? ` · ${fmtClock(r.time)}` : ""} — {r.title}
                </span>
                <button className="btn small" style={{ color: "var(--hot)", padding: "0 6px" }} onClick={() => removeRecurring(r.id)}>×</button>
              </div>
            ))}
            <input className="input" style={{ padding: "5px 9px", fontSize: 12 }} placeholder="Recurring task title…" value={rec.title} onChange={(e) => setRec({ ...rec, title: e.target.value })} />
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <button className="btn small" style={rec.cadence === "weekly" ? { background: "var(--accent-dim)", borderColor: "var(--accent)" } : undefined} onClick={() => setRec({ ...rec, cadence: "weekly" })}>Weekly</button>
              <button className="btn small" style={rec.cadence === "monthly" ? { background: "var(--accent-dim)", borderColor: "var(--accent)" } : undefined} onClick={() => setRec({ ...rec, cadence: "monthly" })}>Monthly</button>
              {rec.cadence === "weekly" ? (
                <span className="row" style={{ gap: 3 }}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((lbl, d) => (
                    <button
                      key={d}
                      className="btn small"
                      style={{ padding: "2px 7px", ...(rec.weekdays.includes(d) ? { background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)" } : {}) }}
                      onClick={() => setRec({ ...rec, weekdays: rec.weekdays.includes(d) ? rec.weekdays.filter((x) => x !== d) : [...rec.weekdays, d] })}
                    >
                      {lbl}
                    </button>
                  ))}
                </span>
              ) : (
                <span className="row" style={{ gap: 4, fontSize: 11 }}>
                  day
                  <input className="input num" type="number" min={1} max={31} style={{ width: 56, padding: "3px 6px", fontSize: 12 }} value={rec.dayOfMonth} onChange={(e) => setRec({ ...rec, dayOfMonth: e.target.value })} />
                  <span className="faint">(31 = last day)</span>
                </span>
              )}
              <input className="input" type="time" style={{ width: 105, padding: "3px 6px", fontSize: 12 }} value={rec.time} onChange={(e) => setRec({ ...rec, time: e.target.value })} title="Optional time" />
              <button className="btn small primary" onClick={addRecurring}>add</button>
            </div>
          </div>
        )}
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
