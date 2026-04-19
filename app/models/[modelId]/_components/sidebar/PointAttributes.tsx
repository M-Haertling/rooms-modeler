"use client";

import { useState } from "react";
import { useStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { updatePoint2, updatePoint as serverUpdatePoint, deletePoint } from "@/actions/objects";
import PanelSection from "./PanelSection";

interface Props { pointId: string }

export default function PointAttributes({ pointId }: Props) {
  const pt = useStore((s) => s.points[pointId]);
  const modelId = useStore((s) => s.modelId);
  const updatePoint = useStore((s) => s.updatePoint);
  const movePoint = useStore((s) => s.movePoint);
  const removePoint = useStore((s) => s.removePoint);
  const pushHistory = useStore((s) => s.pushHistory);
  const allPoints = useStore(useShallow((s) => s.points));
  const allSegments = useStore(useShallow((s) => s.segments));

  const [angleInput, setAngleInput] = useState("");
  const [editingAngle, setEditingAngle] = useState(false);

  if (!pt) return null;

  // Find neighbors via connected segments
  const connectedSegs = Object.values(allSegments).filter(
    (s) => s.objectId === pt.objectId && (s.pointAId === pointId || s.pointBId === pointId)
  );
  const neighbors = connectedSegs
    .map((s) => allPoints[s.pointAId === pointId ? s.pointBId : s.pointAId])
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  let angleDeg: number | null = null;
  if (neighbors.length === 2) {
    const vA = { x: neighbors[0].x - pt.x, y: neighbors[0].y - pt.y };
    const vB = { x: neighbors[1].x - pt.x, y: neighbors[1].y - pt.y };
    const lenA = Math.hypot(vA.x, vA.y);
    const lenB = Math.hypot(vB.x, vB.y);
    if (lenA > 0 && lenB > 0) {
      const dot = vA.x * vB.x + vA.y * vB.y;
      angleDeg = Math.acos(Math.max(-1, Math.min(1, dot / (lenA * lenB)))) * (180 / Math.PI);
    }
  }

  async function toggle(field: "locked" | "snapping") {
    const val = !pt[field];
    updatePoint(pointId, { [field]: val });
    await updatePoint2(modelId, pointId, { [field]: val });
  }

  async function applyAngle(raw: string) {
    setEditingAngle(false);
    const target = parseFloat(raw);
    if (isNaN(target) || target <= 0 || target >= 360 || neighbors.length !== 2) return;
    const [A, B] = neighbors;
    const vA = { x: A.x - pt.x, y: A.y - pt.y };
    const vB = { x: B.x - pt.x, y: B.y - pt.y };
    const lenB = Math.hypot(vB.x, vB.y);
    if (lenB === 0) return;
    const cross = vA.x * vB.y - vA.y * vB.x;
    const sign = cross >= 0 ? 1 : -1;
    const angleA = Math.atan2(vA.y, vA.x);
    const newAngleB = angleA + sign * (target * Math.PI / 180);
    const newBx = pt.x + lenB * Math.cos(newAngleB);
    const newBy = pt.y + lenB * Math.sin(newAngleB);
    pushHistory();
    movePoint(B.id, newBx, newBy);
    await serverUpdatePoint(modelId, B.id, newBx, newBy);
  }

  async function handleDelete() {
    pushHistory();
    const { newSegment } = await deletePoint(modelId, pointId);
    removePoint(pointId, newSegment ?? undefined);
  }

  return (
    <PanelSection title="Point">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Position: ({pt.x.toFixed(2)}, {pt.y.toFixed(2)})
        </span>
      </div>

      {angleDeg !== null && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Angle</span>
          {editingAngle ? (
            <input
              autoFocus
              type="number"
              min={1}
              max={359}
              step={0.1}
              defaultValue={angleDeg.toFixed(1)}
              className="w-20 px-1 py-0.5 rounded text-xs text-right outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--accent)" }}
              onBlur={(e) => applyAngle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyAngle((e.target as HTMLInputElement).value);
                if (e.key === "Escape") setEditingAngle(false);
              }}
            />
          ) : (
            <button
              className="text-xs px-1 py-0.5 rounded"
              style={{ color: "var(--text)", background: "var(--surface-2)", border: "1px solid var(--border)" }}
              onClick={() => { setAngleInput(angleDeg!.toFixed(1)); setEditingAngle(true); }}
              title="Click to edit angle"
            >
              {angleDeg.toFixed(1)}°
            </button>
          )}
        </div>
      )}

      <ToggleRow label="Locked" value={pt.locked} onChange={() => toggle("locked")} />
      <ToggleRow label="Snapping" value={pt.snapping} onChange={() => toggle("snapping")} />

      <button
        onClick={handleDelete}
        className="w-full py-1 rounded text-xs mt-1"
        style={{ background: "rgba(255,68,68,0.1)", color: "var(--danger)", border: "1px solid rgba(255,68,68,0.3)" }}
      >
        Delete point
      </button>
    </PanelSection>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "var(--text)" }}>{label}</span>
      <button
        onClick={onChange}
        className="w-10 h-5 rounded-full relative transition-colors"
        style={{ background: value ? "var(--accent)" : "var(--border)" }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
          style={{ background: "#fff", left: value ? "calc(100% - 18px)" : "2px" }}
        />
      </button>
    </div>
  );
}
