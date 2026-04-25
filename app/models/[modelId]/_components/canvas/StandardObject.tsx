"use client";

import { useRef, useCallback } from "react";
import { useStore } from "@/store";
import { updatePoint as serverUpdatePoint } from "@/actions/objects";
import { distance } from "@/lib/geometry";
import { formatLength } from "@/lib/units";
import PointHandle from "./PointHandle";
import SegmentLine from "./SegmentLine";

interface Props {
  objectId: string;
}

export default function StandardObject({ objectId }: Props) {
  const obj = useStore((s) => s.objects[objectId]);
  const allObjects = useStore((s) => s.objects);
  const allPoints = useStore((s) => s.points);
  const allSegments = useStore((s) => s.segments);
  const selectedObjectIds = useStore((s) => s.selectedObjectIds);
  const selectedPointIds = useStore((s) => s.selectedPointIds);
  const selectedSegmentIds = useStore((s) => s.selectedSegmentIds);
  const selectObject = useStore((s) => s.selectObject);
  const movePoint = useStore((s) => s.movePoint);
  const zoom = useStore((s) => s.zoom);
  const panOffset = useStore((s) => s.panOffset);
  const modelId = useStore((s) => s.modelId);
  const unit = useStore((s) => s.unit);
  const pushHistory = useStore((s) => s.pushHistory);

  const setSnapIndicator = useStore((s) => s.setSnapIndicator);

  const fillRef = useRef<SVGPolygonElement>(null);
  const dragStart = useRef<{ wx: number; wy: number; pts: { id: string; x: number; y: number }[] } | null>(null);
  const hasDragged = useRef(false);

  const SNAP_THRESHOLD = 0.25;

  if (!obj) return null;

  const objPoints = Object.values(allPoints)
    .filter((p) => p.objectId === objectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const objSegments = Object.values(allSegments)
    .filter((s) => s.objectId === objectId);

  const polygonPoints = objPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const isObjSelected = selectedObjectIds.has(objectId);

  const screenToWorld = (clientX: number, clientY: number) => {
    const svg = fillRef.current?.ownerSVGElement;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: (p.x - panOffset.x) / zoom, y: (p.y - panOffset.y) / zoom };
  };

  const handleFillPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (obj.locked) return;
    e.stopPropagation();
    pushHistory();
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    hasDragged.current = false;

    // Collect own points + all descendant objects' points
    function collectDescendantPoints(oid: string): { id: string; x: number; y: number }[] {
      const pts = Object.values(allPoints)
        .filter((p) => p.objectId === oid)
        .map((p) => ({ id: p.id, x: p.x, y: p.y }));
      for (const child of Object.values(allObjects)) {
        if (child.parentObjectId === oid) pts.push(...collectDescendantPoints(child.id));
      }
      return pts;
    }

    dragStart.current = {
      wx: world.x,
      wy: world.y,
      pts: collectDescendantPoints(objectId),
    };
    (e.currentTarget as SVGPolygonElement).setPointerCapture(e.pointerId);
  };

  const handleFillPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    e.stopPropagation();
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    let dx = world.x - dragStart.current.wx;
    let dy = world.y - dragStart.current.wy;
    hasDragged.current = true;

    let snapped = false;
    outer: for (const pt of dragStart.current.pts) {
      if (!allPoints[pt.id]?.snapping) continue;
      const newX = pt.x + dx;
      const newY = pt.y + dy;
      for (const p of Object.values(allPoints)) {
        if (p.objectId === objectId || !p.snapping) continue;
        if (distance({ x: newX, y: newY }, { x: p.x, y: p.y }) < SNAP_THRESHOLD) {
          dx = p.x - pt.x;
          dy = p.y - pt.y;
          setSnapIndicator(p.id);
          snapped = true;
          break outer;
        }
      }
    }
    if (!snapped) setSnapIndicator(null);

    for (const pt of dragStart.current.pts) {
      movePoint(pt.id, pt.x + dx, pt.y + dy);
    }
  };

  const handleFillPointerUp = async (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    e.stopPropagation();
    const movedPtIds = dragStart.current.pts.map((p) => p.id);
    dragStart.current = null;
    setSnapIndicator(null);
    if (!hasDragged.current) return;
    for (const pid of movedPtIds) {
      const p = allPoints[pid];
      if (p) await serverUpdatePoint(modelId, p.id, p.x, p.y);
    }
  };

  return (
    <g
      onClick={(e) => {
        if (hasDragged.current) { hasDragged.current = false; return; }
        e.stopPropagation();
        selectObject(objectId, e.shiftKey);
      }}
      style={{ cursor: "pointer" }}
    >
      {/* Fill polygon — drag handle */}
      {objPoints.length >= 3 && (
        <polygon
          ref={fillRef}
          points={polygonPoints}
          fill={obj.fillEnabled ? obj.fillColor : "none"}
          stroke="none"
          fillOpacity={obj.fillEnabled ? obj.fillOpacity : 0}
          style={{ pointerEvents: "visibleFill", cursor: obj.locked ? "not-allowed" : "grab", touchAction: "none" }}
          onPointerDown={handleFillPointerDown}
          onPointerMove={handleFillPointerMove}
          onPointerUp={handleFillPointerUp}
        />
      )}

      {/* Segments (outlines + hit areas) */}
      {objSegments.map((seg) => (
        <SegmentLine
          key={seg.id}
          segmentId={seg.id}
          isSelected={selectedSegmentIds.has(seg.id)}
          isParentSelected={isObjSelected}
        />
      ))}

      {/* Object outline — one line per segment so transparent ones are skipped */}
      {objSegments.map((seg) => {
        if (seg.transparent) return null;
        const pA = allPoints[seg.pointAId];
        const pB = allPoints[seg.pointBId];
        if (!pA || !pB) return null;
        return (
          <line
            key={`outline-${seg.id}`}
            x1={pA.x} y1={pA.y}
            x2={pB.x} y2={pB.y}
            stroke={obj.lineColor}
            strokeWidth={obj.lineThickness / 50}
            style={{ pointerEvents: "none" }}
          />
        );
      })}

      {/* Dimension labels */}
      {objSegments.map((seg) => {
        if (!obj.showDimensions && !seg.showDimensions) return null;
        const pA = allPoints[seg.pointAId];
        const pB = allPoints[seg.pointBId];
        if (!pA || !pB) return null;
        const mx = (pA.x + pB.x) / 2;
        const my = (pA.y + pB.y) / 2;
        const len = distance({ x: pA.x, y: pA.y }, { x: pB.x, y: pB.y });
        const label = formatLength(len, unit);
        const dx = pB.x - pA.x;
        const dy = pB.y - pA.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const fs = 11 / zoom;
        const offset = 8 / zoom;
        return (
          <g key={`dim-${seg.id}`} transform={`translate(${mx},${my}) rotate(${angle > 90 || angle < -90 ? angle + 180 : angle})`} style={{ pointerEvents: "none" }}>
            <text
              x={0}
              y={-offset}
              fontSize={fs}
              textAnchor="middle"
              dominantBaseline="auto"
              fill={obj.lineColor}
              stroke="var(--surface)"
              strokeWidth={3 / zoom}
              paintOrder="stroke"
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Point handles */}
      {objPoints.map((p) => (
        <PointHandle
          key={p.id}
          pointId={p.id}
          isSelected={selectedPointIds.has(p.id)}
          isParentSelected={isObjSelected && !selectedPointIds.has(p.id)}
        />
      ))}
    </g>
  );
}
