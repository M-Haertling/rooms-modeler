"use client";

import { useRef, useCallback } from "react";
import { useStore } from "@/store";
import { updatePoint as serverUpdatePoint } from "@/actions/objects";
import { boundingBox } from "@/lib/geometry";

interface Props {
  objectId: string;
}

type Handle = "n" | "e" | "s" | "w";

export default function RoundObject({ objectId }: Props) {
  const obj = useStore((s) => s.objects[objectId]);
  const allPoints = useStore((s) => s.points);
  const zoom = useStore((s) => s.zoom);
  const panOffset = useStore((s) => s.panOffset);
  const modelId = useStore((s) => s.modelId);
  const movePoint = useStore((s) => s.movePoint);
  const selectObject = useStore((s) => s.selectObject);
  const selectedObjectIds = useStore((s) => s.selectedObjectIds);
  const pushHistory = useStore((s) => s.pushHistory);

  const draggingHandle = useRef<{ handle: Handle; pointId: string } | null>(null);
  const bodyDragStart = useRef<{ wx: number; wy: number; pts: { id: string; x: number; y: number }[] } | null>(null);
  const hasDragged = useRef(false);
  const ellipseRef = useRef<SVGEllipseElement>(null);

  const objPoints = Object.values(allPoints)
    .filter((p) => p.objectId === objectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const bbox = boundingBox(objPoints.map((p) => ({ x: p.x, y: p.y })));
  const cx = bbox.cx;
  const cy = bbox.cy;
  const rx = bbox.width / 2;
  const ry = bbox.height / 2;

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = ellipseRef.current?.ownerSVGElement;
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
    (e: React.PointerEvent, handle: Handle, pointId: string) => {
      e.stopPropagation();
      if (obj?.locked) return;
      pushHistory();
      draggingHandle.current = { handle, pointId };
      (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
    },
    [obj?.locked, pushHistory]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingHandle.current) return;
      e.stopPropagation();
      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;
      const { handle, pointId } = draggingHandle.current;

      const oppositeMap: Record<Handle, { x: number; y: number }> = {
        n: { x: cx, y: cy + ry },
        s: { x: cx, y: cy - ry },
        e: { x: cx - rx, y: cy },
        w: { x: cx + rx, y: cy },
      };
      const opp = oppositeMap[handle];

      let newX = world.x;
      let newY = world.y;
      const newCx = (newX + opp.x) / 2;
      const newCy = (newY + opp.y) / 2;
      const newRx = Math.abs(newX - opp.x) / 2;
      const newRy = Math.abs(newY - opp.y) / 2;

      // Update all 4 cardinal points
      const cardinalIds: Record<Handle, string | undefined> = { n: undefined, e: undefined, s: undefined, w: undefined };
      for (const p of objPoints) {
        const dx = p.x - cx; const dy = p.y - cy;
        if (Math.abs(dy) > Math.abs(dx) && dy < 0) cardinalIds.n = p.id;
        else if (Math.abs(dy) > Math.abs(dx) && dy > 0) cardinalIds.s = p.id;
        else if (dx > 0) cardinalIds.e = p.id;
        else cardinalIds.w = p.id;
      }

      if (cardinalIds.n) movePoint(cardinalIds.n, newCx, newCy - newRy);
      if (cardinalIds.s) movePoint(cardinalIds.s, newCx, newCy + newRy);
      if (cardinalIds.e) movePoint(cardinalIds.e, newCx + newRx, newCy);
      if (cardinalIds.w) movePoint(cardinalIds.w, newCx - newRx, newCy);
    },
    [cx, cy, rx, ry, objPoints, screenToWorld, movePoint]
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (!draggingHandle.current) return;
      e.stopPropagation();
      draggingHandle.current = null;
      for (const p of objPoints) {
        await serverUpdatePoint(modelId, p.id, p.x, p.y);
      }
    },
    [modelId, objPoints]
  );

  const handleBodyPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (obj?.locked || draggingHandle.current) return;
      e.stopPropagation();
      pushHistory();
      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;
      hasDragged.current = false;
      bodyDragStart.current = {
        wx: world.x,
        wy: world.y,
        pts: objPoints.map((p) => ({ id: p.id, x: p.x, y: p.y })),
      };
      (e.currentTarget as SVGEllipseElement).setPointerCapture(e.pointerId);
    },
    [obj?.locked, pushHistory, screenToWorld, objPoints]
  );

  const handleBodyPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!bodyDragStart.current) return;
      e.stopPropagation();
      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;
      const dx = world.x - bodyDragStart.current.wx;
      const dy = world.y - bodyDragStart.current.wy;
      hasDragged.current = true;
      for (const pt of bodyDragStart.current.pts) {
        movePoint(pt.id, pt.x + dx, pt.y + dy);
      }
    },
    [screenToWorld, movePoint]
  );

  const handleBodyPointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (!bodyDragStart.current) return;
      e.stopPropagation();
      bodyDragStart.current = null;
      if (!hasDragged.current) return;
      for (const p of objPoints) {
        await serverUpdatePoint(modelId, p.id, p.x, p.y);
      }
    },
    [modelId, objPoints]
  );

  if (!obj) return null;
  const isSelected = selectedObjectIds.has(objectId);
  const handleR = 5 / zoom;

  const handles: { handle: Handle; hx: number; hy: number }[] = [
    { handle: "n", hx: cx, hy: cy - ry },
    { handle: "s", hx: cx, hy: cy + ry },
    { handle: "e", hx: cx + rx, hy: cy },
    { handle: "w", hx: cx - rx, hy: cy },
  ];

  return (
    <g
      onClick={(e) => {
        if (hasDragged.current) { hasDragged.current = false; return; }
        e.stopPropagation();
        selectObject(objectId, e.shiftKey);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ cursor: "pointer" }}
    >
      <ellipse
        ref={ellipseRef}
        cx={cx} cy={cy} rx={rx} ry={ry}
        fill={obj.fillColor}
        stroke={obj.lineColor}
        strokeWidth={obj.lineThickness / 50}
        opacity={0.85}
        style={{ cursor: obj.locked ? "not-allowed" : "grab", touchAction: "none" }}
        onPointerDown={handleBodyPointerDown}
        onPointerMove={handleBodyPointerMove}
        onPointerUp={handleBodyPointerUp}
      />
      {isSelected && handles.map(({ handle, hx, hy }) => {
        const ptId = objPoints[handles.findIndex((h) => h.handle === handle)]?.id;
        return (
          <circle
            key={handle}
            cx={hx} cy={hy} r={handleR}
            fill="#6c63ff" stroke="#fff" strokeWidth={1 / zoom}
            style={{ cursor: "nwse-resize", touchAction: "none" }}
            onPointerDown={(e) => ptId && handlePointerDown(e, handle, ptId)}
          />
        );
      })}
    </g>
  );
}
