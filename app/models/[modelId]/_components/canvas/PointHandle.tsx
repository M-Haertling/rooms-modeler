"use client";

import { useRef, useCallback } from "react";
import { useStore } from "@/store";
import { distance, constrainToLockedSegment } from "@/lib/geometry";
import { updatePoint as serverUpdatePoint } from "@/actions/objects";

const SNAP_THRESHOLD = 0.25;

interface Props {
  pointId: string;
  isSelected: boolean;
  isParentSelected: boolean;
}

export default function PointHandle({ pointId, isSelected, isParentSelected }: Props) {
  const pt = useStore((s) => s.points[pointId]);
  const allPoints = useStore((s) => s.points);
  const allSegments = useStore((s) => s.segments);
  const modelId = useStore((s) => s.modelId);
  const zoom = useStore((s) => s.zoom);
  const panOffset = useStore((s) => s.panOffset);
  const movePoint = useStore((s) => s.movePoint);
  const selectPoint = useStore((s) => s.selectPoint);
  const setSnapIndicator = useStore((s) => s.setSnapIndicator);
  const pushHistory = useStore((s) => s.pushHistory);

  const isDragging = useRef(false);
  const circleRef = useRef<SVGCircleElement>(null);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = circleRef.current?.ownerSVGElement;
      if (!svg) return null;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const svgPt = svg.createSVGPoint();
      svgPt.x = clientX;
      svgPt.y = clientY;
      const p = svgPt.matrixTransform(ctm.inverse());
      return { x: (p.x - panOffset.x) / zoom, y: (p.y - panOffset.y) / zoom };
    },
    [zoom, panOffset]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      if (pt?.xLocked && pt?.yLocked) return;
      pushHistory();
      isDragging.current = true;
      (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
      selectPoint(pointId, e.shiftKey);
    },
    [pt?.xLocked, pt?.yLocked, pushHistory, selectPoint, pointId]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || (pt?.xLocked && pt?.yLocked)) return;
      e.stopPropagation();

      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;

      let { x, y } = world;

      // Snap to nearby snappable points
      let positionSnapped = false;
      if (pt.snapping) {
        for (const p of Object.values(allPoints)) {
          if (p.id === pointId || !p.snapping) continue;
          if (distance({ x, y }, { x: p.x, y: p.y }) < SNAP_THRESHOLD) {
            x = p.x;
            y = p.y;
            setSnapIndicator(p.id);
            positionSnapped = true;
            break;
          }
        }
        if (!positionSnapped) setSnapIndicator(null);
      }

      // Angle snap to 5-degree increments (skip when position-snapped to another point)
      if (!positionSnapped) {
        const ANGLE_STEP = Math.PI / 36; // 5 degrees
        let bestX = x, bestY = y, bestDist = Infinity;
        for (const seg of Object.values(allSegments)) {
          if (seg.pointAId !== pointId && seg.pointBId !== pointId) continue;
          const anchorId = seg.pointAId === pointId ? seg.pointBId : seg.pointAId;
          const anchor = allPoints[anchorId];
          if (!anchor) continue;
          const dx = x - anchor.x;
          const dy = y - anchor.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) continue;
          const snappedAngle = Math.round(Math.atan2(dy, dx) / ANGLE_STEP) * ANGLE_STEP;
          const sx = anchor.x + dist * Math.cos(snappedAngle);
          const sy = anchor.y + dist * Math.sin(snappedAngle);
          const d = Math.sqrt((sx - x) ** 2 + (sy - y) ** 2);
          if (d < bestDist) { bestDist = d; bestX = sx; bestY = sy; }
        }
        x = bestX; y = bestY;
      }

      // Locked-segment length constraints
      for (const seg of Object.values(allSegments)) {
        if (!seg.locked) continue;
        if (seg.pointAId !== pointId && seg.pointBId !== pointId) continue;
        const anchorId = seg.pointAId === pointId ? seg.pointBId : seg.pointAId;
        const anchor = allPoints[anchorId];
        if (!anchor) continue;
        if (anchor.xLocked && anchor.yLocked) { x = pt.x; y = pt.y; break; }
        const lockedLen = distance({ x: anchor.x, y: anchor.y }, { x: pt.x, y: pt.y });
        const constrained = constrainToLockedSegment({ x, y }, { x: anchor.x, y: anchor.y }, lockedLen);
        x = constrained.x;
        y = constrained.y;
      }

      movePoint(pointId, x, y);
    },
    [pt, pointId, allPoints, allSegments, screenToWorld, movePoint, setSnapIndicator]
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      e.stopPropagation();
      isDragging.current = false;
      setSnapIndicator(null);
      if (pt) await serverUpdatePoint(modelId, pointId, pt.x, pt.y);
    },
    [modelId, pointId, pt, setSnapIndicator]
  );

  if (!pt) return null;

  const r = 5 / zoom;
  const fill = isSelected
    ? "#6c63ff"
    : isParentSelected
    ? "rgba(108,99,255,0.4)"
    : pt.xLocked && pt.yLocked
    ? "#ff7c7c"
    : "var(--surface-2)";

  return (
    <circle
      ref={circleRef}
      cx={pt.x}
      cy={pt.y}
      r={r}
      fill={fill}
      stroke={isSelected ? "#fff" : "#555577"}
      strokeWidth={1 / zoom}
      style={{ cursor: pt.xLocked && pt.yLocked ? "not-allowed" : "grab", touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => { e.stopPropagation(); selectPoint(pointId, e.shiftKey); }}
    />
  );
}
