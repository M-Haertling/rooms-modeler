"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { updatePoint2, updatePoint as serverUpdatePoint, updateSegment } from "@/actions/objects";
import { formatLength, convertFromFeet, convertToFeet } from "@/lib/units";
import { distance, normalize, add, scale, subtract } from "@/lib/geometry";

const TOOLBAR_H = 38;
const GAP = 12;

function pickPosition(
  anchorX: number,
  anchorY: number,
  toolbarW: number,
  bbox: { minX: number; minY: number; maxX: number; maxY: number } | null
): { x: number; y: number } {
  const candidates = [
    { x: anchorX - toolbarW / 2, y: anchorY - TOOLBAR_H - GAP },   // above
    { x: anchorX - toolbarW / 2, y: anchorY + GAP },                // below
    { x: anchorX + GAP,          y: anchorY - TOOLBAR_H / 2 },      // right
    { x: anchorX - toolbarW - GAP, y: anchorY - TOOLBAR_H / 2 },    // left
  ];

  if (!bbox) return candidates[0];

  for (const c of candidates) {
    const overlaps = !(
      c.x + toolbarW < bbox.minX ||
      c.x > bbox.maxX ||
      c.y + TOOLBAR_H < bbox.minY ||
      c.y > bbox.maxY
    );
    if (!overlaps) return c;
  }

  // All candidates overlap — place above the whole object bbox
  return { x: anchorX - toolbarW / 2, y: bbox.minY - TOOLBAR_H - GAP };
}

export default function QuickToolbar() {
  const zoom = useStore((s) => s.zoom);
  const panOffset = useStore((s) => s.panOffset);
  const selectedPointIds = useStore((s) => s.selectedPointIds);
  const selectedSegmentId = useStore((s) => s.selectedSegmentId);
  const points = useStore(useShallow((s) => s.points));
  const segments = useStore(useShallow((s) => s.segments));
  const modelId = useStore((s) => s.modelId);
  const unit = useStore((s) => s.unit);
  const updatePointStore = useStore((s) => s.updatePoint);
  const updateSegmentStore = useStore((s) => s.updateSegment);
  const movePoint = useStore((s) => s.movePoint);
  const pushHistory = useStore((s) => s.pushHistory);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarW, setToolbarW] = useState(280);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const pointIds = [...selectedPointIds];
  const singlePointId = pointIds.length === 1 ? pointIds[0] : null;
  const pt = singlePointId ? points[singlePointId] : null;
  const seg = selectedSegmentId ? segments[selectedSegmentId] : null;

  // Reset drag when selection changes
  const selectionKey = `${singlePointId ?? ""}:${selectedSegmentId ?? ""}`;
  useEffect(() => { setDragOffset({ x: 0, y: 0 }); }, [selectionKey]);

  // Measure actual toolbar width after render
  useLayoutEffect(() => {
    if (toolbarRef.current) {
      const w = toolbarRef.current.getBoundingClientRect().width;
      if (w > 0) setToolbarW(w);
    }
  });

  // Anchor in screen coords
  let anchorX: number | null = null;
  let anchorY: number | null = null;
  let objectId: string | null = null;

  if (pt) {
    anchorX = pt.x * zoom + panOffset.x;
    anchorY = pt.y * zoom + panOffset.y;
    objectId = pt.objectId;
  } else if (seg) {
    const ptA = points[seg.pointAId];
    const ptB = points[seg.pointBId];
    if (ptA && ptB) {
      anchorX = ((ptA.x + ptB.x) / 2) * zoom + panOffset.x;
      anchorY = ((ptA.y + ptB.y) / 2) * zoom + panOffset.y;
      objectId = seg.objectId;
    }
  }

  if (anchorX === null || anchorY === null) return null;

  // Object bounding box with margin
  const objectPts = objectId
    ? Object.values(points).filter((p) => p.objectId === objectId)
    : [];
  const bbox = objectPts.length >= 2 ? {
    minX: Math.min(...objectPts.map((p) => p.x * zoom + panOffset.x)) - GAP,
    minY: Math.min(...objectPts.map((p) => p.y * zoom + panOffset.y)) - GAP,
    maxX: Math.max(...objectPts.map((p) => p.x * zoom + panOffset.x)) + GAP,
    maxY: Math.max(...objectPts.map((p) => p.y * zoom + panOffset.y)) + GAP,
  } : null;

  const base = pickPosition(anchorX, anchorY, toolbarW, bbox);
  const left = base.x + dragOffset.x;
  const top = base.y + dragOffset.y;

  return (
    <div
      ref={toolbarRef}
      className="absolute flex items-center gap-0.5 rounded-lg px-1 py-1 select-none"
      style={{
        left,
        top,
        zIndex: 50,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        whiteSpace: "nowrap",
      }}
    >
      <GripHandle dragOffset={dragOffset} setDragOffset={setDragOffset} />
      <Divider />
      {pt && (
        <PointContent
          pointId={singlePointId!}
          pt={pt}
          modelId={modelId}
          points={points}
          segments={segments}
          updatePointStore={updatePointStore}
          movePoint={movePoint}
          pushHistory={pushHistory}
        />
      )}
      {seg && !pt && (
        <SegmentContent
          seg={seg}
          modelId={modelId}
          points={points}
          unit={unit}
          updateSegmentStore={updateSegmentStore}
          movePoint={movePoint}
        />
      )}
    </div>
  );
}

// ── Grip handle ───────────────────────────────────────────────────────────────

function GripHandle({
  dragOffset,
  setDragOffset,
}: {
  dragOffset: { x: number; y: number };
  setDragOffset: (v: { x: number; y: number }) => void;
}) {
  const startRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { mx: e.clientX, my: e.clientY, ox: dragOffset.x, oy: dragOffset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    setDragOffset({
      x: startRef.current.ox + e.clientX - startRef.current.mx,
      y: startRef.current.oy + e.clientY - startRef.current.my,
    });
  }

  function onPointerUp() {
    startRef.current = null;
  }

  return (
    <div
      className="flex items-center justify-center w-5 h-7 rounded cursor-grab active:cursor-grabbing"
      style={{ color: "var(--text-muted)", opacity: 0.5 }}
      title="Drag to reposition"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <GripIcon />
    </div>
  );
}

// ── Point content ─────────────────────────────────────────────────────────────

function PointContent({
  pointId, pt, modelId, points, segments, updatePointStore, movePoint, pushHistory,
}: {
  pointId: string;
  pt: any;
  modelId: string;
  points: Record<string, any>;
  segments: Record<string, any>;
  updatePointStore: (id: string, patch: object) => void;
  movePoint: (id: string, x: number, y: number) => void;
  pushHistory: () => void;
}) {
  const [editingAngle, setEditingAngle] = useState(false);

  const connectedSegs = Object.values(segments).filter(
    (s: any) => s.objectId === pt.objectId && (s.pointAId === pointId || s.pointBId === pointId)
  );
  const neighbors = connectedSegs
    .map((s: any) => points[s.pointAId === pointId ? s.pointBId : s.pointAId])
    .filter(Boolean)
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

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
    updatePointStore(pointId, { [field]: val });
    await updatePoint2(modelId, pointId, { [field]: val });
  }

  async function applyAngle(raw: string) {
    setEditingAngle(false);
    const target = parseFloat(raw);
    if (isNaN(target) || target <= 0 || target >= 360 || neighbors.length !== 2) return;
    const [A, B] = neighbors;
    const vA = { x: A.x - pt.x, y: A.y - pt.y };
    const lenB = Math.hypot(B.x - pt.x, B.y - pt.y);
    if (lenB === 0) return;
    const cross = vA.x * (B.y - pt.y) - vA.y * (B.x - pt.x);
    const sign = cross >= 0 ? 1 : -1;
    const angleA = Math.atan2(vA.y, vA.x);
    const newAngleB = angleA + sign * (target * Math.PI / 180);
    pushHistory();
    movePoint(B.id, pt.x + lenB * Math.cos(newAngleB), pt.y + lenB * Math.sin(newAngleB));
    await serverUpdatePoint(modelId, B.id, pt.x + lenB * Math.cos(newAngleB), pt.y + lenB * Math.sin(newAngleB));
  }

  return (
    <>
      <ToggleBtn active={pt.locked} title={pt.locked ? "Unlock point" : "Lock point"} onClick={() => toggle("locked")}>
        <LockIcon locked={pt.locked} />
      </ToggleBtn>
      <ToggleBtn active={pt.snapping} title={pt.snapping ? "Disable snapping" : "Enable snapping"} onClick={() => toggle("snapping")}>
        <SnapIcon />
      </ToggleBtn>
      {angleDeg !== null && (
        <>
          <Divider />
          {editingAngle ? (
            <input
              autoFocus
              type="number" min={1} max={359} step={0.1}
              defaultValue={angleDeg.toFixed(1)}
              className="w-16 px-1 text-xs text-right outline-none rounded"
              style={{ background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--accent)" }}
              onBlur={(e) => applyAngle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyAngle((e.target as HTMLInputElement).value);
                if (e.key === "Escape") setEditingAngle(false);
              }}
            />
          ) : (
            <button
              className="px-2 text-xs rounded"
              style={{ color: "var(--text-muted)" }}
              title="Interior angle — click to edit"
              onClick={() => setEditingAngle(true)}
            >
              ∠ {angleDeg.toFixed(1)}°
            </button>
          )}
        </>
      )}
    </>
  );
}

// ── Segment content ───────────────────────────────────────────────────────────

function SegmentContent({
  seg, modelId, points, unit, updateSegmentStore, movePoint,
}: {
  seg: any;
  modelId: string;
  points: Record<string, any>;
  unit: any;
  updateSegmentStore: (id: string, patch: object) => void;
  movePoint: (id: string, x: number, y: number) => void;
}) {
  const [editingAngle, setEditingAngle] = useState(false);
  const [editingLength, setEditingLength] = useState(false);

  const ptA = points[seg.pointAId];
  const ptB = points[seg.pointBId];
  if (!ptA || !ptB) return null;

  const len = distance({ x: ptA.x, y: ptA.y }, { x: ptB.x, y: ptB.y });
  const angleDeg = (Math.atan2(ptB.y - ptA.y, ptB.x - ptA.x) * 180) / Math.PI;
  const bothLocked = ptA.locked && ptB.locked;

  async function toggleField(field: "locked" | "transparent" | "showDimensions") {
    updateSegmentStore(seg.id, { [field]: !seg[field] });
    await updateSegment(modelId, seg.id, { [field]: !seg[field] });
  }

  async function applyAngle(raw: string) {
    const newAngleDeg = parseFloat(raw);
    if (isNaN(newAngleDeg)) { setEditingAngle(false); return; }
    const newAngleRad = (newAngleDeg * Math.PI) / 180;
    const dir = { x: Math.cos(newAngleRad), y: Math.sin(newAngleRad) };
    if (!ptB.locked) {
      const nb = add({ x: ptA.x, y: ptA.y }, scale(dir, len));
      movePoint(seg.pointBId, nb.x, nb.y);
      await serverUpdatePoint(modelId, seg.pointBId, nb.x, nb.y);
    } else if (!ptA.locked) {
      const na = subtract({ x: ptB.x, y: ptB.y }, scale(dir, len));
      movePoint(seg.pointAId, na.x, na.y);
      await serverUpdatePoint(modelId, seg.pointAId, na.x, na.y);
    }
    setEditingAngle(false);
  }

  async function applyLength(raw: string) {
    const newLen = convertToFeet(parseFloat(raw), unit);
    if (isNaN(newLen) || newLen <= 0) { setEditingLength(false); return; }
    const dir = normalize(subtract({ x: ptB.x, y: ptB.y }, { x: ptA.x, y: ptA.y }));
    if (!ptB.locked) {
      const nb = add({ x: ptA.x, y: ptA.y }, scale(dir, newLen));
      movePoint(seg.pointBId, nb.x, nb.y);
      await serverUpdatePoint(modelId, seg.pointBId, nb.x, nb.y);
    } else if (!ptA.locked) {
      const na = subtract({ x: ptB.x, y: ptB.y }, scale(dir, newLen));
      movePoint(seg.pointAId, na.x, na.y);
      await serverUpdatePoint(modelId, seg.pointAId, na.x, na.y);
    }
    setEditingLength(false);
  }

  return (
    <>
      <ToggleBtn active={seg.locked} title={seg.locked ? "Unlock length" : "Lock length"} onClick={() => toggleField("locked")}>
        <LockIcon locked={seg.locked} />
      </ToggleBtn>
      <ToggleBtn active={seg.transparent} title={seg.transparent ? "Close opening" : "Mark as opening"} onClick={() => toggleField("transparent")}>
        <OpeningIcon />
      </ToggleBtn>
      <ToggleBtn active={seg.showDimensions} title={seg.showDimensions ? "Hide dimension" : "Show dimension"} onClick={() => toggleField("showDimensions")}>
        <DimIcon />
      </ToggleBtn>
      <Divider />
      {editingLength ? (
        <input
          autoFocus type="number" min={0.01} step={0.1}
          defaultValue={convertFromFeet(len, unit).toFixed(2)}
          className="w-16 px-1 text-xs text-right outline-none rounded"
          style={{ background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--accent)" }}
          onBlur={(e) => applyLength(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyLength((e.target as HTMLInputElement).value);
            if (e.key === "Escape") setEditingLength(false);
          }}
        />
      ) : (
        <button
          disabled={bothLocked}
          className="px-2 text-xs rounded"
          style={{ color: "var(--text-muted)", opacity: bothLocked ? 0.4 : 1 }}
          title={bothLocked ? "Both endpoints locked" : "Length — click to edit"}
          onClick={() => setEditingLength(true)}
        >
          {formatLength(len, unit)}
        </button>
      )}
      <Divider />
      {editingAngle ? (
        <input
          autoFocus type="number" step={0.1}
          defaultValue={angleDeg.toFixed(1)}
          className="w-16 px-1 text-xs text-right outline-none rounded"
          style={{ background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--accent)" }}
          onBlur={(e) => applyAngle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyAngle((e.target as HTMLInputElement).value);
            if (e.key === "Escape") setEditingAngle(false);
          }}
        />
      ) : (
        <button
          disabled={bothLocked}
          className="px-2 text-xs rounded"
          style={{ color: "var(--text-muted)", opacity: bothLocked ? 0.4 : 1 }}
          title={bothLocked ? "Both endpoints locked" : "Angle — click to edit"}
          onClick={() => setEditingAngle(true)}
        >
          {angleDeg.toFixed(1)}°
        </button>
      )}
    </>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Divider() {
  return <div className="w-px h-5 mx-0.5 shrink-0" style={{ background: "var(--border)" }} />;
}

function ToggleBtn({
  active, title, onClick, children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
      style={{ background: active ? "var(--accent)" : "transparent", color: active ? "#fff" : "var(--text-muted)" }}
    >
      {children}
    </button>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
      <circle cx="2" cy="3" r="1.5" /><circle cx="8" cy="3" r="1.5" />
      <circle cx="2" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" />
      <circle cx="2" cy="13" r="1.5" /><circle cx="8" cy="13" r="1.5" />
    </svg>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return locked ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function SnapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function OpeningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18M3 6h3M18 6h3M3 18h3M18 18h3" />
    </svg>
  );
}

function DimIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l3-3 3 3M6 6v12M21 9l-3-3-3 3M18 6v12M3 18h18" />
    </svg>
  );
}
