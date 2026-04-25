"use client";

import { useState } from "react";
import { useStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { updatePoint2, updatePoint as serverUpdatePoint, deletePoint } from "@/actions/objects";
import PanelSection from "./PanelSection";

interface Props { pointIds: string[] }

function getMixed<T>(values: T[]): T | "mixed" {
  if (values.length === 0) return "mixed";
  return values.every((v) => v === values[0]) ? values[0] : "mixed";
}

export default function PointAttributes({ pointIds }: Props) {
  const allPoints = useStore(useShallow((s) => s.points));
  const allSegments = useStore(useShallow((s) => s.segments));
  const modelId = useStore((s) => s.modelId);
  const updatePoint = useStore((s) => s.updatePoint);
  const movePoint = useStore((s) => s.movePoint);
  const removePoint = useStore((s) => s.removePoint);
  const pushHistory = useStore((s) => s.pushHistory);

  const [editingX, setEditingX] = useState(false);
  const [editingY, setEditingY] = useState(false);
  const [editingAngle, setEditingAngle] = useState(false);

  const pts = pointIds.map((id) => allPoints[id]).filter(Boolean);
  if (pts.length === 0) return null;

  const single = pts.length === 1;
  const pt = pts[0];

  const xVal = getMixed(pts.map((p) => p.x));
  const yVal = getMixed(pts.map((p) => p.y));
  const xLocked = getMixed(pts.map((p) => p.xLocked));
  const yLocked = getMixed(pts.map((p) => p.yLocked));
  const angleLocked = getMixed(pts.map((p) => p.angleLocked));
  const snapping = getMixed(pts.map((p) => p.snapping));

  async function toggleField(field: "xLocked" | "yLocked" | "angleLocked" | "snapping") {
    const current = getMixed(pts.map((p) => p[field]));
    const val = current === true ? false : true;
    for (const p of pts) {
      updatePoint(p.id, { [field]: val });
      await updatePoint2(modelId, p.id, { [field]: val });
    }
  }

  // Angle only for single-point selection with exactly 2 neighbors
  let angleDeg: number | null = null;
  let neighbors: typeof pts = [];
  if (single) {
    const connectedSegs = Object.values(allSegments).filter(
      (s) => s.objectId === pt.objectId && (s.pointAId === pt.id || s.pointBId === pt.id)
    );
    neighbors = connectedSegs
      .map((s) => allPoints[s.pointAId === pt.id ? s.pointBId : s.pointAId])
      .filter(Boolean)
      .sort((a, b) => a.sortOrder - b.sortOrder);

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
  }

  async function applyX(raw: string) {
    setEditingX(false);
    const newX = parseFloat(raw);
    if (isNaN(newX)) return;
    pushHistory();
    for (const p of pts) {
      movePoint(p.id, newX, p.y);
      await serverUpdatePoint(modelId, p.id, newX, p.y);
    }
  }

  async function applyY(raw: string) {
    setEditingY(false);
    const newY = parseFloat(raw);
    if (isNaN(newY)) return;
    pushHistory();
    for (const p of pts) {
      movePoint(p.id, p.x, newY);
      await serverUpdatePoint(modelId, p.id, p.x, newY);
    }
  }

  async function applyAngle(raw: string) {
    setEditingAngle(false);
    if (!single || neighbors.length !== 2 || angleDeg === null) return;
    const target = parseFloat(raw);
    if (isNaN(target) || target <= 0 || target >= 360) return;
    const [A, B] = neighbors;
    const vA = { x: A.x - pt.x, y: A.y - pt.y };
    const vB = { x: B.x - pt.x, y: B.y - pt.y };
    const lenA = Math.hypot(vA.x, vA.y);
    const lenB = Math.hypot(vB.x, vB.y);
    if (lenA === 0 || lenB === 0) return;
    const cross = vA.x * vB.y - vA.y * vB.x;
    const sign = cross >= 0 ? 1 : -1;
    const bFullyLocked = B.xLocked && B.yLocked;
    const aFullyLocked = A.xLocked && A.yLocked;
    if (!bFullyLocked) {
      const angleA = Math.atan2(vA.y, vA.x);
      const newAngleB = angleA + sign * (target * Math.PI / 180);
      const newBx = pt.x + lenB * Math.cos(newAngleB);
      const newBy = pt.y + lenB * Math.sin(newAngleB);
      pushHistory();
      movePoint(B.id, newBx, newBy);
      await serverUpdatePoint(modelId, B.id, newBx, newBy);
    } else if (!aFullyLocked) {
      const angleB = Math.atan2(vB.y, vB.x);
      const newAngleA = angleB - sign * (target * Math.PI / 180);
      const newAx = pt.x + lenA * Math.cos(newAngleA);
      const newAy = pt.y + lenA * Math.sin(newAngleA);
      pushHistory();
      movePoint(A.id, newAx, newAy);
      await serverUpdatePoint(modelId, A.id, newAx, newAy);
    }
  }

  async function handleDelete() {
    pushHistory();
    for (const p of pts) {
      const { newSegment } = await deletePoint(modelId, p.id);
      removePoint(p.id, newSegment ?? undefined);
    }
  }

  const xDisplay = xVal === "mixed" ? "—" : xVal.toFixed(2);
  const yDisplay = yVal === "mixed" ? "—" : yVal.toFixed(2);
  const xDefault = xVal === "mixed" ? "" : xVal.toFixed(2);
  const yDefault = yVal === "mixed" ? "" : yVal.toFixed(2);

  const title = single ? "Point" : `Points (${pts.length})`;

  return (
    <PanelSection title={title}>
      <div className="space-y-1.5">
        <FieldRow
          label="X"
          editing={editingX}
          displayValue={xDisplay}
          defaultEditValue={xDefault}
          onStartEdit={() => setEditingX(true)}
          onApply={applyX}
          onCancel={() => setEditingX(false)}
          locked={xLocked}
          onToggleLock={() => toggleField("xLocked")}
          disabled={xLocked === true}
        />
        <FieldRow
          label="Y"
          editing={editingY}
          displayValue={yDisplay}
          defaultEditValue={yDefault}
          onStartEdit={() => setEditingY(true)}
          onApply={applyY}
          onCancel={() => setEditingY(false)}
          locked={yLocked}
          onToggleLock={() => toggleField("yLocked")}
          disabled={yLocked === true}
        />
        {single && angleDeg !== null && (
          <FieldRow
            label="Angle"
            editing={editingAngle}
            displayValue={`${angleDeg.toFixed(1)}°`}
            defaultEditValue={angleDeg.toFixed(1)}
            onStartEdit={() => setEditingAngle(true)}
            onApply={applyAngle}
            onCancel={() => setEditingAngle(false)}
            locked={angleLocked}
            onToggleLock={() => toggleField("angleLocked")}
            disabled={angleLocked === true || neighbors.length !== 2}
          />
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs" style={{ color: "var(--text)" }}>Snapping</span>
          <MixedToggle value={snapping} onToggle={() => toggleField("snapping")} color="var(--accent)" />
        </div>

        <button
          onClick={handleDelete}
          className="w-full py-1 rounded text-xs mt-1"
          style={{ background: "rgba(255,68,68,0.1)", color: "var(--danger)", border: "1px solid rgba(255,68,68,0.3)" }}
        >
          {single ? "Delete point" : `Delete ${pts.length} points`}
        </button>
      </div>
    </PanelSection>
  );
}

interface FieldRowProps {
  label: string;
  editing: boolean;
  displayValue: string;
  defaultEditValue: string;
  onStartEdit: () => void;
  onApply: (value: string) => void;
  onCancel: () => void;
  locked: boolean | "mixed";
  onToggleLock: () => void;
  disabled?: boolean;
}

function FieldRow({ label, editing, displayValue, defaultEditValue, onStartEdit, onApply, onCancel, locked, onToggleLock, disabled }: FieldRowProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs w-8 shrink-0" style={{ color: "var(--text-muted)" }}>{label}</span>
      {editing ? (
        <input
          autoFocus
          type="number"
          step={0.01}
          defaultValue={defaultEditValue}
          className="flex-1 px-1.5 py-0.5 rounded text-xs outline-none"
          style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--accent)" }}
          onBlur={(e) => onApply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApply((e.target as HTMLInputElement).value);
            if (e.key === "Escape") onCancel();
          }}
        />
      ) : (
        <button
          className="flex-1 text-left px-1.5 py-0.5 rounded text-xs"
          style={{
            background: "var(--surface-2)",
            color: disabled ? "var(--text-muted)" : "var(--text)",
            border: "1px solid var(--border)",
            cursor: disabled ? "default" : "pointer",
          }}
          onClick={() => !disabled && onStartEdit()}
        >
          {displayValue}
        </button>
      )}
      <LockButton locked={locked} onToggle={onToggleLock} />
    </div>
  );
}

function MixedToggle({ value, onToggle, color }: { value: boolean | "mixed"; onToggle: () => void; color: string }) {
  const isOn = value === true;
  const isMixed = value === "mixed";
  return (
    <button
      onClick={onToggle}
      className="w-10 h-5 rounded-full relative transition-colors"
      style={{ background: isOn ? color : isMixed ? "var(--text-muted)" : "var(--border)" }}
      title={isMixed ? "Mixed — click to enable all" : undefined}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full transition-transform flex items-center justify-center"
        style={{
          background: "#fff",
          left: isOn ? "calc(100% - 18px)" : isMixed ? "calc(50% - 8px)" : "2px",
          fontSize: 9,
          color: isMixed ? "var(--text-muted)" : "transparent",
        }}
      >
        {isMixed ? "–" : ""}
      </span>
    </button>
  );
}

function LockButton({ locked, onToggle }: { locked: boolean | "mixed"; onToggle: () => void }) {
  const isLocked = locked === true;
  const isMixed = locked === "mixed";
  return (
    <button
      onClick={onToggle}
      title={isLocked ? "Unlock" : isMixed ? "Mixed — click to lock all" : "Lock"}
      className="shrink-0 p-0.5 rounded"
      style={{ color: isLocked ? "var(--accent)" : isMixed ? "var(--text-muted)" : "var(--text-muted)", opacity: isMixed ? 0.6 : 1 }}
    >
      {isLocked ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1C9.24 1 7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2h-1V6c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v2H9V6c0-1.66 1.34-3 3-3zm6 7v10H6V10h12zm-6 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      )}
    </button>
  );
}
