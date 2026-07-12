"use client";
// A safety net for one-click actions: "Marked done — UNDO". The parent owns
// the state; this just renders the toast and auto-expires it.
import { useEffect } from "react";

export function UndoToast({
  label,
  onUndo,
  onExpire,
  ms = 8000,
}: {
  label: string;
  onUndo: () => void;
  onExpire: () => void;
  ms?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onExpire, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  return (
    <div className="toast row" style={{ gap: 14, maxWidth: "min(92vw, 560px)" }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <button
        className="btn small primary"
        style={{ flexShrink: 0 }}
        onClick={() => {
          onUndo();
          onExpire();
        }}
      >
        ↩ undo
      </button>
    </div>
  );
}
