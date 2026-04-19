"use client";

interface Props {
  zoom: number;
  panOffset: { x: number; y: number };
}

export default function CanvasGrid({ zoom, panOffset }: Props) {
  const gridSize = zoom; // 1 unit = zoom pixels
  const minorGrid = gridSize;
  const majorGrid = gridSize * 5;

  // Compute pattern offset to align with pan
  const ox = ((panOffset.x % majorGrid) + majorGrid) % majorGrid;
  const oy = ((panOffset.y % majorGrid) + majorGrid) % majorGrid;

  return (
    <g>
      <defs>
        <pattern
          id="minorGrid"
          width={minorGrid}
          height={minorGrid}
          patternUnits="userSpaceOnUse"
          x={ox}
          y={oy}
        >
          <path
            d={`M ${minorGrid} 0 L 0 0 0 ${minorGrid}`}
            fill="none"
            stroke="var(--border)"
            strokeWidth="0.3"
            opacity="0.4"
          />
        </pattern>
        <pattern
          id="majorGrid"
          width={majorGrid}
          height={majorGrid}
          patternUnits="userSpaceOnUse"
          x={ox}
          y={oy}
        >
          <rect width={majorGrid} height={majorGrid} fill="url(#minorGrid)" />
          <path
            d={`M ${majorGrid} 0 L 0 0 0 ${majorGrid}`}
            fill="none"
            stroke="var(--border)"
            strokeWidth="0.6"
            opacity="0.6"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#majorGrid)" />
    </g>
  );
}
