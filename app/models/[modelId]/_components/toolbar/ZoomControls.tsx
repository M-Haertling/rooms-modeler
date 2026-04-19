"use client";

import { useStore } from "@/store";

export default function ZoomControls() {
  const zoom = useStore((s) => s.zoom);
  const setZoom = useStore((s) => s.setZoom);

  return (
    <div className="flex items-center gap-1">
      <button
        className="w-6 h-6 text-xs rounded flex items-center justify-center"
        style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
        onClick={() => setZoom(zoom / 1.25)}
      >−</button>
      <span className="text-xs w-10 text-center" style={{ color: "var(--text-muted)" }}>
        {Math.round((zoom / 50) * 100)}%
      </span>
      <button
        className="w-6 h-6 text-xs rounded flex items-center justify-center"
        style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
        onClick={() => setZoom(zoom * 1.25)}
      >+</button>
      <button
        className="px-2 h-6 text-xs rounded"
        style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
        onClick={() => setZoom(50)}
      >Reset</button>
    </div>
  );
}
