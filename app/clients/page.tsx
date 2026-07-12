"use client";
// Clients tab — the client work board (rebuilt from the schedule tracker).
// Projects with progress, phase, deadline, milestone, budget, task checklists
// with due dates, and an iteration log. Everything editable in place.
import { useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { api, clientDateKey } from "@/lib/client";
import type { ClientProject, ClientTask } from "@/lib/types";

export default function ClientsPage() {
  const [projects, setProjects] = useState<ClientProject[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const today = clientDateKey();

  function load() {
    api<{ projects: ClientProject[] }>("/api/clients").then((r) => setProjects(r.projects)).catch(() => {});
  }
  useEffect(load, []);

  async function patch(id: string, body: Partial<ClientProject>) {
    setProjects((ps) => (ps ?? []).map((p) => (p.id === id ? { ...p, ...body } : p)));
    await api(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify(body) }).catch(load);
    window.dispatchEvent(new CustomEvent("jarvis:capture")); // refresh home card
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await api("/api/clients", { method: "POST", body: JSON.stringify({ name: newName.trim() }) });
    setNewName("");
    setAdding(false);
    load();
  }

  async function removeProject(p: ClientProject) {
    if (!confirm(`Delete "${p.name}" and its ${p.tasks.length} tasks? This can't be undone.`)) return;
    await api(`/api/clients/${p.id}`, { method: "DELETE" });
    load();
  }

  if (projects === null) return <div className="faint">Loading…</div>;

  const active = projects.filter((p) => p.status !== "done");
  const done = projects.filter((p) => p.status === "done");

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="row">
          <span className="label" style={{ fontSize: 12 }}>Clients //</span>
          <span className="chip ok">{active.length} active</span>
          {done.length > 0 && <span className="chip">{done.length} done</span>}
        </div>
        <div className="row">
          {adding ? (
            <form className="row" onSubmit={addProject}>
              <input
                className="input"
                style={{ width: 300 }}
                placeholder="Client — Project name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <button className="btn primary">Add</button>
              <button type="button" className="btn" onClick={() => setAdding(false)}>cancel</button>
            </form>
          ) : (
            <button className="btn" onClick={() => setAdding(true)}>+ new project</button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {[...active, ...done].map((p) => (
          <ProjectCard
            key={p.id}
            p={p}
            today={today}
            open={open === p.id}
            onToggle={() => setOpen(open === p.id ? null : p.id)}
            onPatch={(body) => patch(p.id, body)}
            onDelete={() => removeProject(p)}
          />
        ))}
      </div>
      {projects.length === 0 && (
        <div className="panel faint" style={{ textAlign: "center", padding: 30 }}>
          No client projects yet. Add one above.
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  p,
  today,
  open,
  onToggle,
  onPatch,
  onDelete,
}: {
  p: ClientProject;
  today: string;
  open: boolean;
  onToggle: () => void;
  onPatch: (body: Partial<ClientProject>) => void;
  onDelete: () => void;
}) {
  const [newTask, setNewTask] = useState({ title: "", due: "" });
  const [newNote, setNewNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: p.name,
    phase: p.phase ?? "",
    deadline: p.deadline ?? "",
    next_milestone: p.next_milestone ?? "",
    budget: p.budget ?? "",
    progress: String(p.progress),
  });

  const undone = p.tasks.filter((t) => !t.done);
  const overdue = undone.filter((t) => t.due && t.due < today).length;
  const dueToday = undone.filter((t) => t.due === today).length;

  function toggleTask(task: ClientTask) {
    onPatch({ tasks: p.tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)) });
  }

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTask.title.trim();
    if (!title) return;
    onPatch({
      tasks: [...p.tasks, { id: crypto.randomUUID(), title, done: false, due: newTask.due || null }],
    });
    setNewTask({ title: "", due: "" });
  }

  function addNote(e: React.FormEvent) {
    e.preventDefault();
    const note = newNote.trim();
    if (!note) return;
    onPatch({ iterations: [...p.iterations, { date: today, note }] });
    setNewNote("");
  }

  return (
    <div className="panel" style={{ opacity: p.status === "done" ? 0.55 : 1 }}>
      <div className="spread" style={{ alignItems: "flex-start", cursor: "pointer" }} onClick={onToggle}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>{p.name}</div>
          <div className="faint" style={{ fontSize: 11, marginTop: 3, fontFamily: "var(--mono)" }}>
            {p.phase?.toUpperCase() ?? "—"}
          </div>
        </div>
        <div className="row">
          {overdue > 0 && <span className="chip hot">{overdue} overdue</span>}
          {dueToday > 0 && <span className="chip warm">{dueToday} today</span>}
          <span className={`chip ${p.status === "active" ? "ok" : p.status === "paused" ? "warm" : ""}`}>{p.status}</span>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, gap: 10 }}>
        <div className="bar" style={{ flex: 1, height: 5 }}>
          <div style={{ width: `${p.progress}%` }} />
        </div>
        <span className="num faint" style={{ fontSize: 11 }}>{p.progress}%</span>
      </div>
      <div className="faint" style={{ fontSize: 11, marginTop: 8, fontFamily: "var(--mono)", lineHeight: 1.8 }}>
        {p.deadline && <>DEADLINE {p.deadline} · </>}
        {undone.length} open task{undone.length === 1 ? "" : "s"}
        {p.budget && <> · {p.budget}</>}
        {p.next_milestone && (
          <>
            <br />
            NEXT: {p.next_milestone}
          </>
        )}
      </div>

      {open && (
        <div className="stack" style={{ marginTop: 14, gap: 14 }}>
          <div className="divider" style={{ margin: 0 }} />

          {/* Tasks */}
          <div className="stack" style={{ gap: 5 }}>
            <div className="label">Tasks</div>
            {p.tasks.map((t) => (
              <div key={t.id} className={`habit ${t.done ? "done" : ""}`} style={{ padding: "7px 10px" }}>
                <span className="box" onClick={() => toggleTask(t)}>
                  {t.done ? "✓" : ""}
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    flex: 1,
                    textDecoration: t.done ? "line-through" : "none",
                    opacity: t.done ? 0.5 : 1,
                  }}
                >
                  {t.title}
                </span>
                {t.due && (
                  <span
                    className="num"
                    style={{
                      fontSize: 10,
                      color: !t.done && t.due < today ? "var(--hot)" : !t.done && t.due === today ? "var(--warm)" : "var(--text-faint)",
                    }}
                  >
                    {t.due}
                  </span>
                )}
                <button
                  className="faint"
                  style={{ fontSize: 11 }}
                  onClick={() => onPatch({ tasks: p.tasks.filter((x) => x.id !== t.id) })}
                >
                  ✕
                </button>
              </div>
            ))}
            <form className="row" onSubmit={addTask}>
              <input
                className="input"
                style={{ flex: 2, padding: "6px 10px", fontSize: 12.5 }}
                placeholder="Add a task…"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
              <input
                className="input"
                type="date"
                style={{ width: 150, padding: "6px 10px", fontSize: 12.5 }}
                value={newTask.due}
                onChange={(e) => setNewTask({ ...newTask, due: e.target.value })}
              />
              <button className="btn small">+ </button>
            </form>
          </div>

          {/* Iteration log */}
          <div className="stack" style={{ gap: 5 }}>
            <div className="label">Log</div>
            {[...p.iterations].reverse().slice(0, 4).map((it, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.6 }}>
                <span className="num faint" style={{ fontSize: 10.5 }}>{it.date}</span>{" "}
                <span className="dim">{it.note}</span>
              </div>
            ))}
            <form className="row" onSubmit={addNote}>
              <input
                className="input"
                style={{ flex: 1, padding: "6px 10px", fontSize: 12.5 }}
                placeholder="Add a note to the log…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <button className="btn small">log</button>
            </form>
          </div>

          {/* Project fields */}
          {editing ? (
            <div className="stack">
              <div className="grid-2">
                <label>
                  <span className="label" style={{ fontSize: 8.5 }}>Name (Client — Project)</span>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <label>
                  <span className="label" style={{ fontSize: 8.5 }}>Phase</span>
                  <input className="input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} />
                </label>
                <label>
                  <span className="label" style={{ fontSize: 8.5 }}>Deadline</span>
                  <input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </label>
                <label>
                  <span className="label" style={{ fontSize: 8.5 }}>Progress %</span>
                  <input className="input num" type="number" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })} />
                </label>
                <label>
                  <span className="label" style={{ fontSize: 8.5 }}>Next milestone</span>
                  <input className="input" value={form.next_milestone} onChange={(e) => setForm({ ...form, next_milestone: e.target.value })} />
                </label>
                <label>
                  <span className="label" style={{ fontSize: 8.5 }}>Budget</span>
                  <input className="input" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
                </label>
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
          ) : (
            <div className="row">
              <button className="btn small" onClick={() => setEditing(true)}>✎ edit</button>
              {p.status !== "done" ? (
                <button className="btn small" onClick={() => onPatch({ status: "done", progress: 100 })}>mark done</button>
              ) : (
                <button className="btn small" onClick={() => onPatch({ status: "active" })}>reopen</button>
              )}
              {p.status === "active" ? (
                <button className="btn small" onClick={() => onPatch({ status: "paused" })}>pause</button>
              ) : p.status === "paused" ? (
                <button className="btn small" onClick={() => onPatch({ status: "active" })}>resume</button>
              ) : null}
              <span style={{ flex: 1 }} />
              <button className="btn small" style={{ color: "var(--hot)" }} onClick={onDelete}>delete</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
