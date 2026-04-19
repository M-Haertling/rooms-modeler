"use client";

import { useState } from "react";
import { useStore } from "@/store";
import { createObject } from "@/actions/objects";

export default function AddObjectButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"standard" | "round">("standard");
  const [size, setSize] = useState(2);
  const modelId = useStore((s) => s.modelId);
  const projectId = useStore((s) => s.projectId);
  const addObject = useStore((s) => s.addObject);
  const panOffset = useStore((s) => s.panOffset);
  const zoom = useStore((s) => s.zoom);

  async function handleCreate() {
    const cx = (-panOffset.x / zoom) + 5;
    const cy = (-panOffset.y / zoom) + 5;
    const h = size / 2;

    let pts: { x: number; y: number }[];
    if (kind === "standard") {
      pts = [
        { x: cx - h, y: cy - h },
        { x: cx + h, y: cy - h },
        { x: cx + h, y: cy + h },
        { x: cx - h, y: cy + h },
      ];
    } else {
      pts = [
        { x: cx, y: cy - h },       // N
        { x: cx + h, y: cy },       // E
        { x: cx, y: cy + h },       // S
        { x: cx - h, y: cy },       // W
      ];
    }

    const result = await createObject(modelId, {
      projectId,
      layerId: null,
      kind,
      name: name.trim() || (kind === "standard" ? "Rectangle" : "Ellipse"),
      points: pts,
    });

    addObject(result.object, result.points, result.segments);
    setOpen(false);
    setName("");
    setSize(2);
  }

  return (
    <>
      <button
        className="px-3 py-1 text-xs rounded font-medium"
        style={{ background: "var(--accent)", color: "#fff" }}
        onClick={() => setOpen(true)}
      >
        + Add object
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-lg p-6 w-80 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Add object</h2>

            <div className="space-y-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Untitled"
                className="w-full px-3 py-1.5 rounded text-sm outline-none"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Type</label>
              <div className="flex gap-2">
                {(["standard", "round"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className="flex-1 py-1.5 text-xs rounded capitalize"
                    style={{
                      background: kind === k ? "var(--accent)" : "var(--surface-2)",
                      color: "var(--text)",
                      border: "1px solid var(--border)",
                    }}
                  >{k}</button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>Size (units)</label>
              <input
                type="number"
                value={size}
                min={0.1}
                step={0.5}
                onChange={(e) => setSize(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-1.5 rounded text-sm outline-none"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="flex-1 py-1.5 text-xs rounded" style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={handleCreate} className="flex-1 py-1.5 text-xs rounded font-medium" style={{ background: "var(--accent)", color: "#fff" }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
