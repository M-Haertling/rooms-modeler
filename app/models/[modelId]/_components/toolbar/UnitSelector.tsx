"use client";

import { useStore } from "@/store";
import { UNIT_OPTIONS } from "@/lib/units";
import { updateProjectUnit } from "@/actions/models";
import type { Unit } from "@/types/canvas";

export default function UnitSelector() {
  const unit = useStore((s) => s.unit);
  const modelId = useStore((s) => s.modelId);
  const setUnit = useStore((s) => s.setUnit);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newUnit = e.target.value as Unit;
    setUnit(newUnit);
    await updateProjectUnit(modelId, newUnit);
  }

  return (
    <select
      value={unit}
      onChange={handleChange}
      className="text-xs px-2 py-1 rounded outline-none"
      style={{
        background: "var(--surface-2)",
        color: "var(--text)",
        border: "1px solid var(--border)",
      }}
    >
      {UNIT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
