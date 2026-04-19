"use client";

import { useRef, useCallback } from "react";
import { useStore } from "@/store";
import { updatePoint as serverUpdatePoint } from "@/actions/objects";
import PointHandle from "./PointHandle";
import SegmentLine from "./SegmentLine";

interface Props {
  objectId: string;
}

export default function StandardObject({ objectId }: Props) {
  const obj = useStore((s) => s.objects[objectId]);
  const allPoints = useStore((s) => s.points);
  const allSegments = useStore((s) => s.segments);
  const selectedObjectIds = useStore((s) => s.selectedObjectIds);
  const selectedPointIds = useStore((s) => s.selectedPointIds);
  const selectedSegmentId = useStore((s) => s.selectedSegmentId);
  const selectObject = useStore((s) => s.selectObject);
  const movePoint = useStore((s) => s.movePoint);
  const zoom = useStore((s) => s.zoom);
  const panOffset = useStore((s) => s.panOffset);
  const modelId = useStore((s) => s.modelId);
  const pushHistory = useStore((s) => s.pushHistory);

  const fillRef = useRef<SVGPolygonElement>(null);
  const dragStart = useRef<{ wx: number; wy: number; pts: { id: string; x: number; y: number }[] } | null>(null);
  const hasDragged = useRef(false);

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
    if (obj.locked) return;
    e.stopPropagation();
    pushHistory();
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    hasDragged.current = false;
    dragStart.current = {
      wx: world.x,
      wy: world.y,
      pts: objPoints.map((p) => ({ id: p.id, x: p.x, y: p.y })),
    };
    (e.currentTarget as SVGPolygonElement).setPointerCapture(e.pointerId);
  };

  const handleFillPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    e.stopPropagation();
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    const dx = world.x - dragStart.current.wx;
    const dy = world.y - dragStart.current.wy;
    hasDragged.current = true;
    for (const pt of dragStart.current.pts) {
      movePoint(pt.id, pt.x + dx, pt.y + dy);
    }
  };

  const handleFillPointerUp = async (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    e.stopPropagation();
    dragStart.current = null;
    if (!hasDragged.current) return;
    for (const p of objPoints) {
      await serverUpdatePoint(modelId, p.id, p.x, p.y);
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
          fill={obj.fillColor}
          stroke="none"
          opacity={0.85}
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
          isSelected={selectedSegmentId === seg.id}
          isParentSelected={isObjSelected}
        />
      ))}

      {/* Object outline (always visible) */}
      {objPoints.length >= 2 && (
        <polygon
          points={polygonPoints}
          fill="none"
          stroke={obj.lineColor}
          strokeWidth={obj.lineThickness / 50}
          style={{ pointerEvents: "none" }}
        />
      )}

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
