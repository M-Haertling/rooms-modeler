"use client";

import { useStore } from "@/store";
import { updatePoint2 } from "@/actions/objects";
import PanelSection from "./PanelSection";

interface Props { pointId: string }

export default function PointAttributes({ pointId }: Props) {
  const pt = useStore((s) => s.points[pointId]);
  const modelId = useStore((s) => s.modelId);
  const updatePoint = useStore((s) => s.updatePoint);

  if (!pt) return null;

  async function toggle(field: "locked" | "snapping") {
    const val = !pt[field];
    updatePoint(pointId, { [field]: val });
    await updatePoint2(modelId, pointId, { [field]: val });
  }

  return (
    <PanelSection title="Point">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Position: ({pt.x.toFixed(2)}, {pt.y.toFixed(2)})
        </span>
      </div>
      <ToggleRow label="Locked" value={pt.locked} onChange={() => toggle("locked")} />
      <ToggleRow label="Snapping" value={pt.snapping} onChange={() => toggle("snapping")} />
    </PanelSection>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "var(--text)" }}>{label}</span>
      <button
        onClick={onChange}
        className="w-10 h-5 rounded-full relative transition-colors"
        style={{ background: value ? "var(--accent)" : "var(--border)" }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
          style={{ background: "#fff", left: value ? "calc(100% - 18px)" : "2px" }}
        />
      </button>
    </div>
  );
}
