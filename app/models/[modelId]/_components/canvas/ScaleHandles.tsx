"use client";

import { useRef, useCallback } from "react";
import { useStore } from "@/store";
import { boundingBox } from "@/lib/geometry";
import { updatePoint as serverUpdatePoint } from "@/actions/objects";

interface Props {
  objectId: string;
}

type Corner = "nw" | "ne" | "se" | "sw";

const CORNER_DIRS: Record<Corner, { x: -1 | 1; y: -1 | 1 }> = {
  nw: { x: -1, y: -1 },
  ne: { x: 1, y: -1 },
  se: { x: 1, y: 1 },
  sw: { x: -1, y: 1 },
};

export default function ScaleHandles({ objectId }: Props) {
  const allPoints = useStore((s) => s.points);
  const zoom = useStore((s) => s.zoom);
  const panOffset = useStore((s) => s.panOffset);
  const modelId = useStore((s) => s.modelId);
  const movePoint = useStore((s) => s.movePoint);
  const pushHistory = useStore((s) => s.pushHistory);

  const objPoints = Object.values(allPoints).filter((p) => p.objectId === objectId);

  const dragState = useRef<{
    corner: Corner;
    anchor: { x: number; y: number };
    origBbox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
    origPoints: { id: string; x: number; y: number }[];
  } | null>(null);

  const rectRef = useRef<SVGRectElement>(null);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = rectRef.current?.ownerSVGElement;
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

  if (objPoints.length === 0) return null;

  const bbox = boundingBox(objPoints.map((p) => ({ x: p.x, y: p.y })));
  const { minX, minY, maxX, maxY } = bbox;

  if (bbox.width === 0 && bbox.height === 0) return null;

  const handleR = 5 / zoom;
  const pad = 2 / zoom;

  const corners: Record<Corner, { x: number; y: number }> = {
    nw: { x: minX - pad, y: minY - pad },
    ne: { x: maxX + pad, y: minY - pad },
    se: { x: maxX + pad, y: maxY + pad },
    sw: { x: minX - pad, y: maxY + pad },
  };

  function handlePointerDown(e: React.PointerEvent, corner: Corner) {
    e.stopPropagation();
    pushHistory();
    const opp: Record<Corner, Corner> = { nw: "se", ne: "sw", se: "nw", sw: "ne" };
    const anchorCorner = corners[opp[corner]];
    dragState.current = {
      corner,
      anchor: anchorCorner,
      origBbox: { ...bbox },
      origPoints: objPoints.map((p) => ({ id: p.id, x: p.x, y: p.y })),
    };
    (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    e.stopPropagation();
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;

    const { corner, anchor, origBbox, origPoints } = dragState.current;
    const dir = CORNER_DIRS[corner];

    // New bounding box dimensions from drag
    const newW = Math.max(0.01, dir.x > 0 ? world.x - anchor.x : anchor.x - world.x);
    const newH = Math.max(0.01, dir.y > 0 ? world.y - anchor.y : anchor.y - world.y);
    const origW = Math.max(0.01, origBbox.width);
    const origH = Math.max(0.01, origBbox.height);

    const scaleX = newW / origW;
    const scaleY = newH / origH;

    for (const op of origPoints) {
      const newX = anchor.x + (op.x - anchor.x) * scaleX;
      const newY = anchor.y + (op.y - anchor.y) * scaleY;
      movePoint(op.id, newX, newY);
    }
  }

  async function handlePointerUp(e: React.PointerEvent) {
    if (!dragState.current) return;
    e.stopPropagation();

    const { origPoints } = dragState.current;
    dragState.current = null;

    // Persist all updated point positions
    const updatedPoints = origPoints.map((op) => {
      const p = allPoints[op.id];
      return p ? { id: p.id, x: p.x, y: p.y } : null;
    }).filter(Boolean) as { id: string; x: number; y: number }[];

    await Promise.all(
      updatedPoints.map((p) => serverUpdatePoint(modelId, p.id, p.x, p.y))
    );
  }

  return (
    <g>
      {/* Dashed bounding rect */}
      <rect
        ref={rectRef}
        x={minX - pad}
        y={minY - pad}
        width={bbox.width + pad * 2}
        height={bbox.height + pad * 2}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1 / zoom}
        strokeDasharray={`${4 / zoom} ${3 / zoom}`}
        pointerEvents="none"
      />
      {/* Corner handles */}
      {(Object.entries(corners) as [Corner, { x: number; y: number }][]).map(([corner, pos]) => (
        <circle
          key={corner}
          cx={pos.x}
          cy={pos.y}
          r={handleR}
          fill="#6c63ff"
          stroke="#fff"
          strokeWidth={1 / zoom}
          style={{
            cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
            touchAction: "none",
          }}
          onPointerDown={(e) => handlePointerDown(e, corner)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      ))}
    </g>
  );
}
