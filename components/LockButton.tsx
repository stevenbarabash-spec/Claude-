"use client";
// Lock button — clears the session cookie and drops you back to the PIN
// screen. One tap when you walk away from the desk.
import { useState } from "react";

export function LockButton() {
  const [busy, setBusy] = useState(false);

  async function lock() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <button
      className="rail-lock"
      onClick={lock}
      disabled={busy}
      title="Lock — require PIN to get back in"
      aria-label="Lock dashboard"
    >
      🔒
    </button>
  );
}
