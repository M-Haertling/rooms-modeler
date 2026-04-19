"use client";

import type { LassoRect } from "@/lib/lasso";

interface Props {
  rect: LassoRect;
  panOffset: { x: number; y: number };
  zoom: number;
}

export default function SelectionLasso({ rect, panOffset, zoom }: Props) {
  const x = panOffset.x + rect.x * zoom;
  const y = panOffset.y + rect.y * zoom;
  const w = rect.w * zoom;
  const h = rect.h * zoom;

  return (
    <rect
      x={Math.min(x, x + w)}
      y={Math.min(y, y + h)}
      width={Math.abs(w)}
      height={Math.abs(h)}
      fill="rgba(108,99,255,0.1)"
      stroke="#6c63ff"
      strokeWidth={1}
      strokeDasharray="4,3"
      style={{ pointerEvents: "none" }}
    />
  );
}
