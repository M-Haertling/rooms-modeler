"use client";

import { useState, useCallback, useRef } from "react";
import { useStore } from "@/store";
import { distance } from "@/lib/geometry";
import { formatLength } from "@/lib/units";
import { updatePoint as serverUpdatePoint } from "@/actions/objects";

interface Props {
  segmentId: string;
  isSelected: boolean;
  isParentSelected: boolean;
}

export default function SegmentLine({ segmentId, isSelected, isParentSelected }: Props) {
  const seg = useStore((s) => s.segments[segmentId]);
  const ptA = useStore((s) => seg && s.points[seg.pointAId]);
  const ptB = useStore((s) => seg && s.points[seg.pointBId]);
  const obj = useStore((s) => seg && s.objects[seg.objectId]);
  const unit = useStore((s) => s.unit);
  const zoom = useStore((s) => s.zoom);
  const panOffset = useStore((s) => s.panOffset);
  const modelId = useStore((s) => s.modelId);
  const selectSegment = useStore((s) => s.selectSegment);
  const movePoint = useStore((s) => s.movePoint);
  const pushHistory = useStore((s) => s.pushHistory);
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const isDragging = useRef(false);
  const dragStart = useRef<{ wx: number; wy: number; ax: number; ay: number; bx: number; by: number } | null>(null);
  const hitRef = useRef<SVGLineElement>(null);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const svg = hitRef.current?.ownerSVGElement;
      if (!svg) return null;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const pt = svg.createSVGPoint();
      pt.x = clientX; pt.y = clientY;
      const p = pt.matrixTransform(ctm.inverse());
      return { x: (p.x - panOffset.x) / zoom, y: (p.y - panOffset.y) / zoom };
    },
    [zoom, panOffset]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      selectSegment(segmentId, e.shiftKey);
      if (seg?.locked) return;
      const world = screenToWorld(e.clientX, e.clientY);
      if (!world || !ptA || !ptB) return;
      pushHistory();
      isDragging.current = true;
      dragStart.current = { wx: world.x, wy: world.y, ax: ptA.x, ay: ptA.y, bx: ptB.x, by: ptB.y };
      (e.currentTarget as SVGLineElement).setPointerCapture(e.pointerId);
    },
    [seg, ptA, ptB, segmentId, selectSegment, screenToWorld, pushHistory]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || !dragStart.current || !seg || !ptA || !ptB) return;
      e.stopPropagation();
      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;
      const dx = world.x - dragStart.current.wx;
      const dy = world.y - dragStart.current.wy;
      movePoint(seg.pointAId,
        ptA.xLocked ? dragStart.current.ax : dragStart.current.ax + dx,
        ptA.yLocked ? dragStart.current.ay : dragStart.current.ay + dy,
      );
      movePoint(seg.pointBId,
        ptB.xLocked ? dragStart.current.bx : dragStart.current.bx + dx,
        ptB.yLocked ? dragStart.current.by : dragStart.current.by + dy,
      );
    },
    [seg, ptA, ptB, screenToWorld, movePoint]
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (!isDragging.current || !dragStart.current) return;
      e.stopPropagation();
      isDragging.current = false;
      if (ptA) await serverUpdatePoint(modelId, seg!.pointAId, ptA.x, ptA.y);
      if (ptB) await serverUpdatePoint(modelId, seg!.pointBId, ptB.x, ptB.y);
      dragStart.current = null;
    },
    [modelId, seg, ptA, ptB]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const svg = (e.currentTarget as SVGLineElement).ownerSVGElement;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPt = svg.createSVGPoint();
    svgPt.x = e.clientX;
    svgPt.y = e.clientY;
    const p = svgPt.matrixTransform(ctm.inverse());
    setTooltipPos({ x: p.x, y: p.y });
  }, []);

  if (!seg || !ptA || !ptB) return null;

  const len = distance({ x: ptA.x, y: ptA.y }, { x: ptB.x, y: ptB.y });
  const midX = (ptA.x + ptB.x) / 2;
  const midY = (ptA.y + ptB.y) / 2;

  const stroke = isSelected
    ? (seg.transparent ? "#22c55e" : "#6c63ff")
    : seg.locked
    ? "#ff9944"
    : isParentSelected
    ? "rgba(108,99,255,0.5)"
    : "transparent";

  const showLine = !seg.transparent || isSelected;

  // Door arc rendering
  let doorEl: React.ReactNode = null;
  if (seg.segmentType === "door" && len > 0) {
    const isHingeAtA = seg.doorHingeSide === "left";
    const hinge = isHingeAtA ? { x: ptA.x, y: ptA.y } : { x: ptB.x, y: ptB.y };
    const free = isHingeAtA ? { x: ptB.x, y: ptB.y } : { x: ptA.x, y: ptA.y };

    // Always derive perpendicular from the fixed A→B direction so that
    // hinge side and swing direction are fully independent controls.
    const segTheta = Math.atan2(ptB.y - ptA.y, ptB.x - ptA.x);
    // doorSwingIn=true → segTheta+PI/2 (outward for typical room-above layout)
    const perpAngle = seg.doorSwingIn ? segTheta + Math.PI / 2 : segTheta - Math.PI / 2;
    const openX = hinge.x + len * Math.cos(perpAngle);
    const openY = hinge.y + len * Math.sin(perpAngle);
    // Sweep flag derived from cross-product analysis for the short 90° arc.
    const sweepFlag = isHingeAtA === seg.doorSwingIn ? 1 : 0;

    const doorColor = isSelected
      ? (seg.transparent ? "#22c55e" : "#6c63ff")
      : (obj?.lineColor ?? "#888888");
    const sw = (isSelected ? 2 : 1.5) / zoom;

    doorEl = (
      <g style={{ pointerEvents: "none" }}>
        {/* Open door panel */}
        <line
          x1={hinge.x} y1={hinge.y}
          x2={openX} y2={openY}
          stroke={doorColor}
          strokeWidth={sw}
        />
        {/* Swing arc */}
        <path
          d={`M ${free.x} ${free.y} A ${len} ${len} 0 0 ${sweepFlag} ${openX} ${openY}`}
          fill="none"
          stroke={doorColor}
          strokeWidth={sw}
          strokeDasharray={`${4 / zoom},${3 / zoom}`}
        />
      </g>
    );
  }

  // Window rendering
  let windowEl: React.ReactNode = null;
  if (seg.segmentType === "window" && len > 0) {
    const segTheta = Math.atan2(ptB.y - ptA.y, ptB.x - ptA.x);
    const px = Math.cos(segTheta + Math.PI / 2);
    const py = Math.sin(segTheta + Math.PI / 2);
    const dx = Math.cos(segTheta);
    const dy = Math.sin(segTheta);

    const glassOffset = 0.15;
    const jambExt = 0.12;
    const lightDepth = Math.min(len * 0.8, 2.0);
    const lightFlare = Math.min(len * 0.25, 0.8);

    const windowColor = isSelected ? "#6c63ff" : "#3b82f6";
    const sw = (isSelected ? 2 : 1.5) / zoom;

    // Inner glass line
    const iax = ptA.x + px * glassOffset;
    const iay = ptA.y + py * glassOffset;
    const ibx = ptB.x + px * glassOffset;
    const iby = ptB.y + py * glassOffset;

    // Jambs at each end
    const ja1x = ptA.x - px * jambExt;
    const ja1y = ptA.y - py * jambExt;
    const ja2x = ptA.x + px * (glassOffset + jambExt);
    const ja2y = ptA.y + py * (glassOffset + jambExt);
    const jb1x = ptB.x - px * jambExt;
    const jb1y = ptB.y - py * jambExt;
    const jb2x = ptB.x + px * (glassOffset + jambExt);
    const jb2y = ptB.y + py * (glassOffset + jambExt);

    // Light cone trapezoid from inner glass line outward
    const lp1x = iax;
    const lp1y = iay;
    const lp2x = ibx;
    const lp2y = iby;
    const lp3x = ibx + px * lightDepth + dx * lightFlare;
    const lp3y = iby + py * lightDepth + dy * lightFlare;
    const lp4x = iax + px * lightDepth - dx * lightFlare;
    const lp4y = iay + py * lightDepth - dy * lightFlare;

    windowEl = (
      <g style={{ pointerEvents: "none" }}>
        {/* Light beam */}
        <polygon
          points={`${lp1x},${lp1y} ${lp2x},${lp2y} ${lp3x},${lp3y} ${lp4x},${lp4y}`}
          fill="rgba(255,248,176,0.18)"
          stroke="none"
        />
        {/* Outer glass pane */}
        <line x1={ptA.x} y1={ptA.y} x2={ptB.x} y2={ptB.y}
          stroke={windowColor} strokeWidth={sw * 1.5} />
        {/* Inner glass pane */}
        <line x1={iax} y1={iay} x2={ibx} y2={iby}
          stroke={windowColor} strokeWidth={sw} />
        {/* Jamb A */}
        <line x1={ja1x} y1={ja1y} x2={ja2x} y2={ja2y}
          stroke={windowColor} strokeWidth={sw} />
        {/* Jamb B */}
        <line x1={jb1x} y1={jb1y} x2={jb2x} y2={jb2y}
          stroke={windowColor} strokeWidth={sw} />
      </g>
    );
  }

  return (
    <g>
      {/* Selection glow */}
      {isSelected && (
        <line
          x1={ptA.x} y1={ptA.y}
          x2={ptB.x} y2={ptB.y}
          stroke={seg.transparent ? "#22c55e" : "#6c63ff"}
          strokeWidth={10 / zoom}
          strokeOpacity={0.3}
          strokeLinecap="round"
          style={{ pointerEvents: "none" }}
        />
      )}
      {/* Visible line */}
      {showLine && <line
        x1={ptA.x} y1={ptA.y}
        x2={ptB.x} y2={ptB.y}
        stroke={stroke}
        strokeWidth={isSelected ? 3 / zoom : 1.5 / zoom}
        strokeDasharray={seg.locked ? `${4 / zoom},${3 / zoom}` : undefined}
        style={{ pointerEvents: "none" }}
      />}
      {/* Door arc */}
      {doorEl}
      {/* Window overlay */}
      {windowEl}
      {/* Fat invisible hit area */}
      <line
        ref={hitRef}
        x1={ptA.x} y1={ptA.y}
        x2={ptB.x} y2={ptB.y}
        stroke="transparent"
        strokeWidth={12 / zoom}
        style={{ cursor: seg.locked ? "not-allowed" : "grab", touchAction: "none" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={handleMouseMove}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={(e) => e.stopPropagation()}
      />
      {/* Hover tooltip — rendered in SVG coordinates (outside the world group scale) */}
      {hovered && (
        <g style={{ pointerEvents: "none" }}>
          <rect
            x={tooltipPos.x + 8}
            y={tooltipPos.y - 20}
            width={120}
            height={22}
            rx={4}
            fill="var(--surface-2)"
            stroke="var(--border)"
            strokeWidth={0.5}
          />
          <text
            x={tooltipPos.x + 14}
            y={tooltipPos.y - 4}
            fontSize={11}
            fill="var(--text)"
          >
            {seg.name ? `${seg.name} · ` : ""}{formatLength(len, unit)}
          </text>
        </g>
      )}
    </g>
  );
}
