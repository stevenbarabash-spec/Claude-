"use client";
// Finance tab — monthly cash-flow: money in, projects, receivables, projections.
import { useCallback, useEffect, useState } from "react";
import { Spark } from "@/components/cards/FinancePulse";
import { Panel } from "@/components/Panel";
import { api, clientDateKey, fmtMoney } from "@/lib/client";
import type { IncomeEntry, Project, Receivable } from "@/lib/types";

interface Projection {
  label: string;
  received: number;
  fromReceivables: number;
  fromRetainers: number;
  total: number;
}
type ProjectRollup = Project & { received: number; owed: number };

interface Summary {
  month: string;
  receivedThisMonth: number;
  owedTotal: number;
  overdueTotal: number;
  overdueCount: number;
  retainerMonthly: number;
  projections: Projection[];
  monthlyHistory: { month: string; total: number }[];
  projects: ProjectRollup[];
  receivables: Receivable[];
  incomeThisMonth: IncomeEntry[];
}

export default function FinancePage() {
  const [s, setS] = useState<Summary | null>(null);

  const load = useCallback(() => {
    api<Summary>("/api/finance").then(setS).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("jarvis:capture", load);
    return () => window.removeEventListener("jarvis:capture", load);
  }, [load]);

  if (!s) return <div className="faint">Loading…</div>;

  const today = clientDateKey();
  const monthLabel = new Date(s.month + "-15T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const projected = (label: string) => s.projections.find((p) => p.label === label);
  const maxProj = Math.max(...s.projections.map((p) => p.total), 1);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="spread">
        <span className="label" style={{ fontSize: 12 }}>Finance // {monthLabel}</span>
        <span className="faint" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
          tell Jarvis: &ldquo;Acme owes me $6k, due the 21st&rdquo; · &ldquo;Relay paid me $4k&rdquo;
        </span>
      </div>

      {/* ── Hero row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16 }}>
        <Panel title="Received this month">
          <div className="big-num" style={{ fontSize: 38 }}>{fmtMoney(s.receivedThisMonth)}</div>
          <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>
            {s.incomeThisMonth.length} payment{s.incomeThisMonth.length === 1 ? "" : "s"} · retainers {fmtMoney(s.retainerMonthly)}/mo
          </div>
          <Spark values={s.monthlyHistory.map((m) => m.total)} />
        </Panel>
        <Panel title="Owed to you">
          <div className="big-num">{fmtMoney(s.owedTotal)}</div>
          <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>{s.receivables.length} open receivables</div>
        </Panel>
        <Panel title="Overdue">
          <div className="big-num" style={{ color: s.overdueCount ? "var(--hot)" : undefined }}>
            {s.overdueCount ? fmtMoney(s.overdueTotal) : "—"}
          </div>
          <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>
            {s.overdueCount ? `${s.overdueCount} invoice${s.overdueCount === 1 ? "" : "s"} past due` : "nothing past due"}
          </div>
        </Panel>
        <Panel title="Projected · this month">
          <div className="big-num accent">{fmtMoney(projected("This month")?.total ?? 0)}</div>
          <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>received + expected</div>
        </Panel>
      </div>

      {/* ── Projections ── */}
      <Panel idx="p1" title="Projections" right={<span>unpaid receivables + active retainers</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {s.projections.map((p) => (
            <div key={p.label}>
              <div className="spread">
                <span className="label">{p.label}</span>
                <span className="num" style={{ fontSize: 15 }}>{fmtMoney(p.total)}</span>
              </div>
              <div className="bar" style={{ marginTop: 8, height: 6 }}>
                <div style={{ width: `${(p.total / maxProj) * 100}%` }} />
              </div>
              <div className="faint" style={{ fontSize: 10.5, marginTop: 6, fontFamily: "var(--mono)", lineHeight: 1.7 }}>
                {p.received > 0 && <>received {fmtMoney(p.received)}<br /></>}
                invoices {fmtMoney(p.fromReceivables)}
                {p.fromRetainers > 0 && <><br />retainers {fmtMoney(p.fromRetainers)}</>}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <ProjectsPanel projects={s.projects} onChange={load} />
        <ReceivablesPanel receivables={s.receivables} projects={s.projects} today={today} onChange={load} />
      </div>

      <IncomePanel income={s.incomeThisMonth} history={s.monthlyHistory} onChange={load} />
    </div>
  );
}

/* ── Projects ─────────────────────────────────────────── */
function ProjectsPanel({ projects, onChange }: { projects: ProjectRollup[]; onChange: () => void }) {
  const [form, setForm] = useState({ name: "", client: "", kind: "fixed", value: "" });
  const [adding, setAdding] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim(),
        client: form.client.trim() || null,
        kind: form.kind,
        value: Number(form.value) || 0,
      }),
    });
    setForm({ name: "", client: "", kind: "fixed", value: "" });
    setAdding(false);
    onChange();
  }

  async function setStatus(id: string, status: Project["status"]) {
    await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    onChange();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete project "${name}"? Its income history stays; only the project is removed.`)) return;
    await api(`/api/projects/${id}`, { method: "DELETE" });
    onChange();
  }

  const active = projects.filter((p) => p.status !== "done");
  const done = projects.filter((p) => p.status === "done");

  return (
    <Panel idx="p2" title="Projects" right={<button className="btn small" onClick={() => setAdding(!adding)}>{adding ? "cancel" : "+ new"}</button>}>
      {adding && (
        <form className="stack" style={{ marginBottom: 14 }} onSubmit={add}>
          <div className="grid-2">
            <input className="input" placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            <input className="input" placeholder="Client" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="fixed">Fixed price (total)</option>
              <option value="retainer">Retainer (per month)</option>
              <option value="hourly">Hourly (rate)</option>
            </select>
            <input className="input num" type="number" placeholder="$ value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </div>
          <button className="btn primary">Add project</button>
        </form>
      )}
      <div className="stack">
        {active.map((p) => (
          <div key={p.id} className="spread" style={{ padding: "10px 0", borderBottom: "1px solid var(--border-soft)", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13.5 }}>{p.name}</div>
              <div className="faint" style={{ fontSize: 11, marginTop: 3, fontFamily: "var(--mono)" }}>
                {(p.client ?? "—").toUpperCase()} · {p.kind === "retainer" ? `${fmtMoney(p.value)}/MO` : p.kind === "hourly" ? `${fmtMoney(p.value)}/HR` : fmtMoney(p.value)}
              </div>
              <div className="faint" style={{ fontSize: 10.5, marginTop: 3, fontFamily: "var(--mono)" }}>
                <span className="accent">{fmtMoney(p.received)} in</span>
                {p.owed > 0 && <> · <span style={{ color: "var(--warm)" }}>{fmtMoney(p.owed)} owed</span></>}
              </div>
            </div>
            <div className="stack" style={{ gap: 5, alignItems: "flex-end" }}>
              <span className={`chip ${p.status === "active" ? "ok" : "warm"}`}>{p.status}</span>
              <div className="row" style={{ gap: 4 }}>
                {p.status === "active" ? (
                  <button className="btn small" onClick={() => setStatus(p.id, "paused")}>pause</button>
                ) : (
                  <button className="btn small" onClick={() => setStatus(p.id, "active")}>resume</button>
                )}
                <button className="btn small" onClick={() => setStatus(p.id, "done")}>done</button>
                <button className="btn small" style={{ color: "var(--hot)" }} onClick={() => remove(p.id, p.name)}>✕</button>
              </div>
            </div>
          </div>
        ))}
        {active.length === 0 && <div className="faint" style={{ fontSize: 13 }}>No active projects.</div>}
        {done.length > 0 && (
          <div className="faint" style={{ fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.08em", paddingTop: 4 }}>
            DONE: {done.map((p) => `${p.name} (${fmtMoney(p.received)})`).join(" · ")}
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ── Receivables ──────────────────────────────────────── */
function ReceivablesPanel({
  receivables,
  projects,
  today,
  onChange,
}: {
  receivables: Receivable[];
  projects: ProjectRollup[];
  today: string;
  onChange: () => void;
}) {
  const [form, setForm] = useState({ client: "", description: "", amount: "", due: "", project_id: "" });
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ client: "", description: "", amount: "", due: "", status: "invoiced" });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client.trim() || !Number(form.amount)) return;
    await api("/api/receivables", {
      method: "POST",
      body: JSON.stringify({
        client: form.client.trim(),
        description: form.description.trim() || null,
        amount: Number(form.amount),
        due_date: form.due || null,
        project_id: form.project_id || null,
        status: "invoiced",
      }),
    });
    setForm({ client: "", description: "", amount: "", due: "", project_id: "" });
    setAdding(false);
    onChange();
  }

  async function markPaid(id: string) {
    await api(`/api/receivables/${id}`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) });
    onChange();
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selected.size} receivable${selected.size === 1 ? "" : "s"}? This can't be undone.`)) return;
    await Promise.all([...selected].map((id) => api(`/api/receivables/${id}`, { method: "DELETE" })));
    setSelected(new Set());
    setEditingId(null);
    onChange();
  }

  function openEditor(r: Receivable) {
    if (editingId === r.id) {
      setEditingId(null);
      return;
    }
    setEditingId(r.id);
    setEdit({
      client: r.client,
      description: r.description ?? "",
      amount: String(r.amount),
      due: r.due_date ?? "",
      status: r.status,
    });
  }

  async function saveEdit(id: string) {
    await api(`/api/receivables/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        client: edit.client.trim() || "Unknown",
        description: edit.description.trim() || null,
        amount: Number(edit.amount) || 0,
        due_date: edit.due || null,
        status: edit.status,
      }),
    });
    setEditingId(null);
    onChange();
  }

  async function deleteOne(id: string) {
    if (!confirm("Delete this receivable? This can't be undone.")) return;
    await api(`/api/receivables/${id}`, { method: "DELETE" });
    setEditingId(null);
    onChange();
  }

  return (
    <Panel
      idx="p3"
      title="Owed to you"
      right={
        <span className="row" style={{ gap: 6 }}>
          {selected.size > 0 && (
            <button className="btn small" style={{ color: "var(--hot)", borderColor: "var(--hot)" }} onClick={deleteSelected}>
              delete {selected.size} selected
            </button>
          )}
          <button className="btn small" onClick={() => setAdding(!adding)}>{adding ? "cancel" : "+ new"}</button>
        </span>
      }
    >
      {adding && (
        <form className="stack" style={{ marginBottom: 14 }} onSubmit={add}>
          <div className="grid-2">
            <input className="input" placeholder="Client" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} autoFocus />
            <input className="input num" type="number" placeholder="$ amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <input className="input" placeholder="What for" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input className="input" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
          </div>
          <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="btn primary">Add receivable</button>
        </form>
      )}
      <div className="stack">
        {receivables.map((r) => {
          const isOverdue = r.due_date && r.due_date < today;
          return (
            <div key={r.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <div className="spread" style={{ padding: "10px 0", alignItems: "flex-start" }}>
                <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    style={{ marginTop: 3, accentColor: "var(--accent)", cursor: "pointer" }}
                  />
                  <div style={{ cursor: "pointer" }} onClick={() => openEditor(r)} title="Click to edit">
                    <div style={{ fontSize: 13.5 }}>
                      {r.client}
                      {r.description && <span className="faint"> — {r.description}</span>}
                    </div>
                    <div className="faint" style={{ fontSize: 11, marginTop: 3, fontFamily: "var(--mono)" }}>
                      {r.due_date ? (isOverdue ? `DUE ${r.due_date} · OVERDUE` : `DUE ${r.due_date}`) : "NO DUE DATE"} · CLICK TO EDIT
                    </div>
                  </div>
                </div>
                <div className="stack" style={{ gap: 5, alignItems: "flex-end" }}>
                  <span className="num" style={{ fontSize: 15, color: isOverdue ? "var(--hot)" : undefined }}>{fmtMoney(r.amount)}</span>
                  <div className="row" style={{ gap: 4 }}>
                    <span className={`chip ${isOverdue ? "hot" : r.status === "invoiced" ? "warm" : "cool"}`}>
                      {isOverdue ? "overdue" : r.status}
                    </span>
                    <button className="btn small" onClick={() => markPaid(r.id)}>paid ✓</button>
                  </div>
                </div>
              </div>
              {editingId === r.id && (
                <div className="stack" style={{ padding: "0 0 12px 26px" }}>
                  <div className="grid-2">
                    <label>
                      <span className="label" style={{ fontSize: 8.5 }}>Client</span>
                      <input className="input" value={edit.client} onChange={(e) => setEdit({ ...edit, client: e.target.value })} />
                    </label>
                    <label>
                      <span className="label" style={{ fontSize: 8.5 }}>Amount ($)</span>
                      <input className="input num" type="number" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} />
                    </label>
                    <label>
                      <span className="label" style={{ fontSize: 8.5 }}>Due date</span>
                      <input className="input" type="date" value={edit.due} onChange={(e) => setEdit({ ...edit, due: e.target.value })} />
                    </label>
                    <label>
                      <span className="label" style={{ fontSize: 8.5 }}>Status</span>
                      <select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                        <option value="expected">expected</option>
                        <option value="invoiced">invoiced</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    <span className="label" style={{ fontSize: 8.5 }}>Description</span>
                    <input className="input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                  </label>
                  <div className="row">
                    <button className="btn primary" onClick={() => saveEdit(r.id)}>Save</button>
                    <button className="btn" onClick={() => setEditingId(null)}>Cancel</button>
                    <span style={{ flex: 1 }} />
                    <button className="btn small" style={{ color: "var(--hot)" }} onClick={() => deleteOne(r.id)}>delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {receivables.length === 0 && <div className="faint" style={{ fontSize: 13 }}>Nobody owes you anything. Ship more.</div>}
      </div>
    </Panel>
  );
}

/* ── Income ───────────────────────────────────────────── */
function IncomePanel({
  income,
  history,
  onChange,
}: {
  income: IncomeEntry[];
  history: { month: string; total: number }[];
  onChange: () => void;
}) {
  const [form, setForm] = useState({ source: "", amount: "", date: "" });
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.source.trim() || !Number(form.amount)) return;
    await api("/api/income", {
      method: "POST",
      body: JSON.stringify({ source: form.source.trim(), amount: Number(form.amount), date: form.date || undefined }),
    });
    setForm({ source: "", amount: "", date: "" });
    setAdding(false);
    onChange();
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selected.size} payment${selected.size === 1 ? "" : "s"} from the log? This can't be undone.`)) return;
    await Promise.all([...selected].map((id) => api(`/api/income/${id}`, { method: "DELETE" })));
    setSelected(new Set());
    onChange();
  }

  return (
    <Panel
      idx="p4"
      title="Money in"
      right={
        <span className="row" style={{ gap: 6 }}>
          {selected.size > 0 && (
            <button className="btn small" style={{ color: "var(--hot)", borderColor: "var(--hot)" }} onClick={deleteSelected}>
              delete {selected.size} selected
            </button>
          )}
          <button className="btn small" onClick={() => setAdding(!adding)}>{adding ? "cancel" : "+ log payment"}</button>
        </span>
      }
    >
      {adding && (
        <form className="row" style={{ marginBottom: 14 }} onSubmit={add}>
          <input className="input" placeholder="From (client / source)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} autoFocus />
          <input className="input num" style={{ maxWidth: 130 }} type="number" placeholder="$ amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className="input" style={{ maxWidth: 160 }} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <button className="btn primary">Log</button>
        </form>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        <div className="stack">
          <div className="label" style={{ marginBottom: 2 }}>This month</div>
          {income.map((e) => (
            <div key={e.id} className="spread" style={{ padding: "7px 0", borderBottom: "1px solid var(--border-soft)" }}>
              <div className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggleSelect(e.id)}
                  style={{ accentColor: "var(--accent)", cursor: "pointer" }}
                />
                <span className="num faint" style={{ fontSize: 11 }}>{e.date.slice(5)}</span>
                <span style={{ fontSize: 13 }}>{e.source}</span>
                <span className="chip">{e.kind}</span>
              </div>
              <span className="num accent" style={{ fontSize: 13.5 }}>+{fmtMoney(e.amount)}</span>
            </div>
          ))}
          {income.length === 0 && <div className="faint" style={{ fontSize: 13 }}>Nothing received yet this month.</div>}
        </div>
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Last 12 months</div>
          <table className="table">
            <tbody>
              {[...history].reverse().map((h) => {
                const max = Math.max(...history.map((x) => x.total), 1);
                return (
                  <tr key={h.month}>
                    <td className="faint" style={{ padding: "5px 8px" }}>
                      {new Date(h.month + "-15T12:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                    </td>
                    <td style={{ width: "55%", padding: "5px 8px" }}>
                      <div className="bar">
                        <div style={{ width: `${(h.total / max) * 100}%` }} />
                      </div>
                    </td>
                    <td style={{ padding: "5px 8px" }}>{fmtMoney(h.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}
