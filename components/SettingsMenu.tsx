"use client";
// Settings — a gear in the top rail. Refresh the whole page, and pick a color
// theme that recolors the accent, cards, glow, and the Matrix rain on the fly.
import { useEffect, useRef, useState } from "react";

interface Theme {
  id: string; // "" = default Matrix Green
  label: string;
  swatch: string;
}

const THEMES: Theme[] = [
  { id: "", label: "Matrix Green", swatch: "#6fe0ae" },
  { id: "blue", label: "Blue", swatch: "#6fa9e0" },
  { id: "cyan", label: "Cyan", swatch: "#5fd7e0" },
  { id: "purple", label: "Purple", swatch: "#b58cf0" },
  { id: "amber", label: "Amber", swatch: "#e0b34f" },
  { id: "red", label: "Red", swatch: "#ef6f6f" },
  { id: "mono", label: "Mono", swatch: "#cfd6da" },
];

export function applyTheme(id: string) {
  const root = document.documentElement;
  if (id) root.dataset.theme = id;
  else delete root.dataset.theme;
  try {
    localStorage.setItem("jarvis-theme", id);
  } catch {}
  // Let the Matrix rain (and anything else) recolor immediately.
  window.dispatchEvent(new CustomEvent("theme:change"));
}

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const [notif, setNotif] = useState<NotificationPermission | "unsupported">("default");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setActive(localStorage.getItem("jarvis-theme") ?? "");
    } catch {}
    setNotif(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  function enableNotifications() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((p) => {
      setNotif(p);
      if (p === "granted") new Notification("Alerts on", { body: "You'll get a heads-up before timed tasks and meetings." });
    });
  }

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function pick(id: string) {
    setActive(id);
    applyTheme(id);
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "flex" }}>
      <button
        className="rail-tab"
        style={{ fontSize: 14, padding: "4px 8px" }}
        onClick={() => setOpen((o) => !o)}
        title="Settings"
        aria-label="Settings"
      >
        ⚙
      </button>
      {open && (
        <div className="settings-pop">
          <div className="label" style={{ fontSize: 10 }}>Settings</div>
          <button
            className="btn small"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => window.location.reload()}
          >
            ↻ Refresh page
          </button>
          <button
            className="btn small"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => {
              window.dispatchEvent(new CustomEvent("layout:reset"));
              setOpen(false);
            }}
          >
            ⤢ Reset card layout
          </button>
          <button
            className={`btn small ${notif === "granted" ? "primary" : ""}`}
            style={{ width: "100%", justifyContent: "center" }}
            disabled={notif === "granted" || notif === "unsupported" || notif === "denied"}
            onClick={enableNotifications}
          >
            {notif === "granted"
              ? "🔔 Alerts on"
              : notif === "denied"
                ? "🔔 Alerts blocked (browser)"
                : notif === "unsupported"
                  ? "🔔 Alerts unsupported"
                  : "🔔 Enable meeting alerts"}
          </button>
          <div>
            <div className="label" style={{ fontSize: 10, marginBottom: 8 }}>Color theme</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`swatch ${active === t.id ? "active" : ""}`}
                  style={{ background: t.swatch }}
                  onClick={() => pick(t.id)}
                  title={t.label}
                  aria-label={t.label}
                />
              ))}
            </div>
            <div className="faint" style={{ fontSize: 10.5, marginTop: 8 }}>
              {THEMES.find((t) => t.id === active)?.label ?? "Matrix Green"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
