"use client";

import { useStore } from "@/store";
import PointAttributes from "./PointAttributes";
import SegmentAttributes from "./SegmentAttributes";
import ObjectAttributes from "./ObjectAttributes";

export default function SidePanel() {
  const mode = useStore((s) => s.sidePanelMode);
  const selectedPointIds = useStore((s) => s.selectedPointIds);
  const selectedSegmentId = useStore((s) => s.selectedSegmentId);
  const selectedObjectIds = useStore((s) => s.selectedObjectIds);

  if (!mode) return null;

  const firstPointId = [...selectedPointIds][0];
  const firstObjectId = [...selectedObjectIds][0];

  return (
    <aside
      className="w-72 shrink-0 overflow-y-auto border-l flex flex-col gap-0"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {mode === "point" && firstPointId && (
        <PointAttributes pointId={firstPointId} />
      )}
      {mode === "segment" && selectedSegmentId && (
        <SegmentAttributes segmentId={selectedSegmentId} />
      )}
      {firstObjectId && (
        <ObjectAttributes objectId={firstObjectId} />
      )}
    </aside>
  );
}
