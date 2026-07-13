"use client";
import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) window.location.href = "/";
    else setError("Wrong password.");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form className="panel" style={{ width: 340, padding: 28 }} onSubmit={submit}>
        <div className="rail-brand" style={{ marginBottom: 18 }}>
          <span className="dot" />
          WARROOM <span className="ver">// LIFE OS</span>
        </div>
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <div style={{ color: "var(--hot)", fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button className="btn primary" style={{ width: "100%", marginTop: 14 }}>
          Enter
        </button>
      </form>
    </div>
  );
}
