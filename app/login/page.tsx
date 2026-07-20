"use client";
import { useState } from "react";

export default function Login() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pin }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) window.location.href = "/";
    else {
      setError("Wrong PIN.");
      setPin("");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form className="panel" style={{ width: 320, padding: 30, textAlign: "center" }} onSubmit={submit}>
        <div className="rail-brand" style={{ marginBottom: 8, justifyContent: "center" }}>
          <span className="dot" />
          WARROOM <span className="ver">// LIFE OS</span>
        </div>
        <div style={{ fontSize: 30, margin: "10px 0 4px" }}>🔒</div>
        <div className="label" style={{ marginBottom: 16 }}>Enter your PIN to unlock</div>
        <input
          className="input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]*"
          placeholder="• • • •"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          autoFocus
          style={{ textAlign: "center", letterSpacing: "0.4em", fontSize: 20, padding: "12px" }}
        />
        {error && <div style={{ color: "var(--hot)", fontSize: 12, marginTop: 10 }}>{error}</div>}
        <button className="btn primary" style={{ width: "100%", marginTop: 16 }} disabled={busy || !pin}>
          {busy ? "…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
