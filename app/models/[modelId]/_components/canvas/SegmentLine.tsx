"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/store";
import { distance } from "@/lib/geometry";
import { formatLength } from "@/lib/units";

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
  const selectSegment = useStore((s) => s.selectSegment);
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

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
  if (seg.door && len > 0) {
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

  return (
    <g>
      {/* Visible line */}
      {showLine && <line
        x1={ptA.x} y1={ptA.y}
        x2={ptB.x} y2={ptB.y}
        stroke={stroke}
        strokeWidth={isSelected ? 2 / zoom : 1.5 / zoom}
        strokeDasharray={seg.locked ? `${4 / zoom},${3 / zoom}` : undefined}
        style={{ pointerEvents: "none" }}
      />}
      {/* Door arc */}
      {doorEl}
      {/* Fat invisible hit area */}
      <line
        x1={ptA.x} y1={ptA.y}
        x2={ptB.x} y2={ptB.y}
        stroke="transparent"
        strokeWidth={12 / zoom}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={handleMouseMove}
        onClick={(e) => { e.stopPropagation(); selectSegment(segmentId); }}
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
