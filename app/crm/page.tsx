"use client";
// CRM (guide §5.4): four urgency tiers, kanban + list views, drag-drop reorder,
// click-to-edit drawer, and AI smart search.
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Task, Urgency } from "@/lib/types";

const TIERS: { key: Urgency; label: string; color: string }[] = [
  { key: "today", label: "Today", color: "var(--hot)" },
  { key: "week", label: "This Week", color: "var(--warm)" },
  { key: "month", label: "This Month", color: "var(--cool)" },
  { key: "someday", label: "Later", color: "var(--text-faint)" },
];

export default function CrmPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [drawer, setDrawer] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [smartIds, setSmartIds] = useState<string[] | null>(null);
  const [smartBusy, setSmartBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const dragId = useRef<string | null>(null);

  function load() {
    api<{ tasks: Task[] }>("/api/tasks").then((r) => setTasks(r.tasks)).catch(() => {});
  }

  useEffect(() => {
    try {
      const v = localStorage.getItem("jarvis-crm-view");
      if (v === "list" || v === "kanban") setView(v);
    } catch {}
    load();
    window.addEventListener("jarvis:capture", load);
    return () => window.removeEventListener("jarvis:capture", load);
  }, []);

  function setViewPersist(v: "kanban" | "list") {
    setView(v);
    try {
      localStorage.setItem("jarvis-crm-view", v);
    } catch {}
  }

  async function patchTask(id: string, patch: Partial<Task>) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)).filter((t) => !t.completed_at));
    await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).catch(() => load());
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    const r = await api<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify({ title, urgency: "week" }) });
    setTasks((ts) => [r.task, ...ts]);
  }

  async function runSmart(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) {
      setSmartIds(null);
      return;
    }
    setSmartBusy(true);
    try {
      const r = await api<{ ids: string[] }>("/api/tasks/smart", { method: "POST", body: JSON.stringify({ query: search }) });
      setSmartIds(r.ids);
    } finally {
      setSmartBusy(false);
    }
  }

  function onDrop(tier: Urgency, beforeId?: string) {
    const id = dragId.current;
    dragId.current = null;
    if (!id) return;
    const inTier = tasks.filter((t) => t.urgency === tier && t.id !== id);
    let score: number;
    if (!beforeId || inTier.length === 0) {
      score = Math.min(0, ...inTier.map((t) => t.priority_score)) - 10;
      if (inTier.length === 0) score = 100;
    } else {
      const idx = inTier.findIndex((t) => t.id === beforeId);
      const above = idx > 0 ? inTier[idx - 1].priority_score : inTier[0].priority_score + 20;
      score = (above + inTier[idx].priority_score) / 2;
    }
    void patchTask(id, { urgency: tier, priority_score: score });
  }

  const visible = smartIds ? smartIds.map((id) => tasks.find((t) => t.id === id)).filter((t): t is Task => Boolean(t)) : tasks;

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div className="row">
          <span className="label" style={{ fontSize: 12 }}>CRM //</span>
          <span className="chip ok">{tasks.length} open</span>
        </div>
        <form className="row" style={{ flex: 1, maxWidth: 480 }} onSubmit={runSmart}>
          <input
            className="input"
            placeholder='Smart search — "what should I do this morning?"'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!e.target.value) setSmartIds(null);
            }}
          />
          <button className="btn" disabled={smartBusy}>{smartBusy ? "…" : "Ask"}</button>
        </form>
        <div className="row">
          <button className={`btn small ${view === "kanban" ? "primary" : ""}`} onClick={() => setViewPersist("kanban")}>
            Kanban
          </button>
          <button className={`btn small ${view === "list" ? "primary" : ""}`} onClick={() => setViewPersist("list")}>
            List
          </button>
        </div>
        <form className="row" onSubmit={addTask}>
          <input className="input" style={{ width: 200 }} placeholder="+ New task…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        </form>
      </div>

      {smartIds && (
        <div className="chip warm" style={{ marginBottom: 12, display: "inline-block" }}>
          smart filter: {smartIds.length} matches ·{" "}
          <button className="accent" onClick={() => { setSmartIds(null); setSearch(""); }}>clear</button>
        </div>
      )}

      {view === "kanban" ? (
        <div className="kanban">
          {TIERS.map((tier) => {
            const col = visible.filter((t) => t.urgency === tier.key).sort((a, b) => b.priority_score - a.priority_score);
            return (
              <div
                key={tier.key}
                className="kanban-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(tier.key)}
              >
                <div className="kanban-col-head">
                  <span className="dot" style={{ background: tier.color }} />
                  <span className="label">{tier.label}</span>
                  <span className="rule" style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
                  <span className="num faint" style={{ fontSize: 11 }}>{col.length}</span>
                </div>
                {col.map((t) => (
                  <div
                    key={t.id}
                    className="task-card"
                    draggable
                    onDragStart={() => (dragId.current = t.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.stopPropagation();
                      onDrop(tier.key, t.id);
                    }}
                    onClick={() => setDrawer(t)}
                  >
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                      {t.key && <span className="accent">★ </span>}
                      {t.title}
                    </div>
                    {t.entity && <div className="faint" style={{ fontSize: 11, marginTop: 3 }}>{t.entity}</div>}
                    <div className="row" style={{ marginTop: 8, gap: 5, flexWrap: "wrap" }}>
                      {t.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className={`chip ${tag === "hot" ? "hot" : tag === "warm" ? "warm" : ""}`}>{tag}</span>
                      ))}
                      {t.time_estimate_min && <span className="num faint" style={{ fontSize: 10 }}>{t.time_estimate_min}m</span>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Tier</th>
              <th>Entity</th>
              <th>Tags</th>
              <th>Done</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id} onClick={() => setDrawer(t)} style={{ cursor: "pointer" }}>
                <td style={{ fontFamily: "var(--sans)" }}>
                  {t.key && <span className="accent">★ </span>}
                  {t.title}
                </td>
                <td className="faint">{t.urgency}</td>
                <td className="faint">{t.entity ?? "—"}</td>
                <td className="faint">{t.tags.join(", ") || "—"}</td>
                <td>
                  <button
                    className="btn small"
                    onClick={(e) => {
                      e.stopPropagation();
                      void patchTask(t.id, { completed_at: new Date().toISOString() });
                    }}
                  >
                    ✓
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {drawer && (
        <TaskDrawer
          task={drawer}
          onClose={() => setDrawer(null)}
          onSave={(patch) => {
            void patchTask(drawer.id, patch);
            setDrawer(null);
          }}
          onDelete={() => {
            void api(`/api/tasks/${drawer.id}`, { method: "DELETE" });
            setTasks((ts) => ts.filter((t) => t.id !== drawer.id));
            setDrawer(null);
          }}
        />
      )}
    </div>
  );
}

function TaskDrawer({
  task,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onSave: (patch: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? "",
    urgency: task.urgency,
    key: task.key,
    entity: task.entity ?? "",
    owner: task.owner ?? "",
    tags: task.tags.join(", "),
    due_date: task.due_date ?? "",
  });

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="spread">
          <span className="label" style={{ fontSize: 11 }}>Edit Task</span>
          <button className="btn small" onClick={onClose}>close</button>
        </div>
        <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="input" placeholder="Description…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid-2">
          <label>
            <span className="label">Urgency</span>
            <select className="input" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value as Urgency })}>
              {TIERS.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Due</span>
            <input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </label>
          <label>
            <span className="label">Entity</span>
            <input className="input" value={form.entity} onChange={(e) => setForm({ ...form, entity: e.target.value })} />
          </label>
          <label>
            <span className="label">Owner</span>
            <input className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          </label>
        </div>
        <label>
          <span className="label">Tags (comma-separated)</span>
          <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </label>
        <label className="row" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={form.key} onChange={(e) => setForm({ ...form, key: e.target.checked })} />
          <span style={{ fontSize: 13 }}>Key task (shows in blockers / session)</span>
        </label>
        <div className="row" style={{ marginTop: "auto" }}>
          <button
            className="btn primary"
            style={{ flex: 1 }}
            onClick={() =>
              onSave({
                title: form.title,
                description: form.description || null,
                urgency: form.urgency,
                key: form.key,
                entity: form.entity || null,
                owner: form.owner || null,
                due_date: form.due_date || null,
                tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
              })
            }
          >
            Save
          </button>
          <button className="btn" onClick={() => onSave({ completed_at: new Date().toISOString() })}>
            Complete
          </button>
          <button className="btn" style={{ color: "var(--hot)" }} onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
