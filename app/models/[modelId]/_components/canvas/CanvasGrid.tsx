"use client";

interface Props {
  zoom: number;
  panOffset: { x: number; y: number };
  background: "dark" | "blueprint" | "light";
}

const GRID_COLORS = {
  dark: { minor: "var(--border)", minorOpacity: 0.4, major: "var(--border)", majorOpacity: 0.6 },
  blueprint: { minor: "rgba(160,210,255,0.5)", minorOpacity: 1, major: "rgba(160,210,255,0.85)", majorOpacity: 1 },
  light: { minor: "rgba(0,0,0,0.18)", minorOpacity: 1, major: "rgba(0,0,0,0.35)", majorOpacity: 1 },
};

export default function CanvasGrid({ zoom, panOffset, background }: Props) {
  const gridSize = zoom; // 1 unit = zoom pixels
  const minorGrid = gridSize;
  const majorGrid = gridSize * 5;
  const colors = GRID_COLORS[background];

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
            stroke={colors.minor}
            strokeWidth="0.3"
            opacity={colors.minorOpacity}
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
            stroke={colors.major}
            strokeWidth="0.6"
            opacity={colors.majorOpacity}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#majorGrid)" />
    </g>
  );
}
