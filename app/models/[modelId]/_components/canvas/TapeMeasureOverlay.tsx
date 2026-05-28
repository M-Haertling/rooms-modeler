"use client";

import { useStore } from "@/store";
import { formatLength } from "@/lib/units";
import type { Unit } from "@/types/canvas";

type Measure = { start: { x: number; y: number }; end: { x: number; y: number } };

function MeasureRenderer({ m, zoom, unit }: { m: Measure; zoom: number; unit: Unit }) {
  const { start, end } = m;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.001) return null;

  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;

  const sw = 2 / zoom;
  const r = 4 / zoom;
  const fontSize = 12 / zoom;
  const pad = 4 / zoom;

  const label = formatLength(dist, unit);
  const approxTextWidth = (label.length * 7) / zoom;
  const bgW = approxTextWidth + pad * 2;
  const bgH = fontSize + pad * 2;

  return (
    <g>
      <line
        x1={start.x} y1={start.y}
        x2={end.x} y2={end.y}
        stroke="#f0c040"
        strokeWidth={sw}
        strokeDasharray={`${8 / zoom} ${4 / zoom}`}
        strokeLinecap="round"
      />
      <circle cx={start.x} cy={start.y} r={r} fill="#f0c040" />
      <circle cx={end.x} cy={end.y} r={r} fill="#f0c040" />
      <rect
        x={mx - bgW / 2}
        y={my - bgH / 2}
        width={bgW}
        height={bgH}
        rx={3 / zoom}
        fill="rgba(0,0,0,0.7)"
      />
      <text
        x={mx}
        y={my}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fill="#f0c040"
        style={{ fontFamily: "monospace", fontWeight: 600, userSelect: "none" }}
      >
        {label}
      </text>
    </g>
  );
}

export default function TapeMeasureOverlay() {
  const tapeMeasure = useStore((s) => s.tapeMeasure);
  const tapeMeasures = useStore((s) => s.tapeMeasures);
  const zoom = useStore((s) => s.zoom);
  const unit = useStore((s) => s.unit);

  if (!tapeMeasure && tapeMeasures.length === 0) return null;

  return (
    <g>
      {tapeMeasures.map((m, i) => (
        <MeasureRenderer key={i} m={m} zoom={zoom} unit={unit} />
      ))}
      {tapeMeasure && <MeasureRenderer m={tapeMeasure} zoom={zoom} unit={unit} />}
    </g>
  );
}
