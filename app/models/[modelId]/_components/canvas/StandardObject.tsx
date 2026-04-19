"use client";

import { useStore } from "@/store";
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

  if (!obj) return null;

  const objPoints = Object.values(allPoints)
    .filter((p) => p.objectId === objectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const objSegments = Object.values(allSegments)
    .filter((s) => s.objectId === objectId);

  const polygonPoints = objPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const isObjSelected = selectedObjectIds.has(objectId);

  return (
    <g
      onClick={(e) => { e.stopPropagation(); selectObject(objectId, e.shiftKey); }}
      style={{ cursor: "pointer" }}
    >
      {/* Fill polygon */}
      {objPoints.length >= 3 && (
        <polygon
          points={polygonPoints}
          fill={obj.fillColor}
          stroke="none"
          opacity={0.85}
          style={{ pointerEvents: "visibleFill" }}
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
