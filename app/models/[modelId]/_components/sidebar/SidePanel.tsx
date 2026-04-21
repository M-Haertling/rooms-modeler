"use client";

import { useStore } from "@/store";
import PointAttributes from "./PointAttributes";
import SegmentAttributes from "./SegmentAttributes";
import ObjectAttributes from "./ObjectAttributes";

export default function SidePanel() {
  const selectedPointIds = useStore((s) => s.selectedPointIds);
  const selectedSegmentIds = useStore((s) => s.selectedSegmentIds);
  const selectedObjectIds = useStore((s) => s.selectedObjectIds);

  const pointIds = [...selectedPointIds];
  const segmentIds = [...selectedSegmentIds];
  const firstObjectId = [...selectedObjectIds][0];

  if (pointIds.length === 0 && segmentIds.length === 0 && !firstObjectId) return null;

  return (
    <aside
      className="w-72 shrink-0 overflow-y-auto border-l flex flex-col gap-0"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {pointIds.length > 0 && <PointAttributes pointIds={pointIds} />}
      {segmentIds.length > 0 && <SegmentAttributes segmentIds={segmentIds} />}
      {firstObjectId && <ObjectAttributes objectId={firstObjectId} />}
    </aside>
  );
}
