"use client";

import { useStore } from "@/store";

export default function SnapIndicator() {
  const snapPointId = useStore((s) => s.snapIndicatorPointId);
  const pt = useStore((s) => snapPointId ? s.points[snapPointId] : null);
  const zoom = useStore((s) => s.zoom);

  if (!pt) return null;

  const r = 8 / zoom;

  return (
    <circle
      cx={pt.x}
      cy={pt.y}
      r={r}
      fill="none"
      stroke="#6c63ff"
      strokeWidth={1.5 / zoom}
      opacity={0.8}
      style={{ pointerEvents: "none" }}
    >
      <animate attributeName="r" values={`${r};${r * 1.5};${r}`} dur="0.8s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.8;0.3;0.8" dur="0.8s" repeatCount="indefinite" />
    </circle>
  );
}
