"use client";

import { useRef, useCallback } from "react";
import { useStore } from "@/store";
import { pointInLasso, segmentInLasso } from "@/lib/lasso";
import type { LassoRect } from "@/lib/lasso";
import CanvasGrid from "./CanvasGrid";
import LayerRenderer from "./LayerRenderer";
import SelectionLasso from "./SelectionLasso";
import SnapIndicator from "./SnapIndicator";

export default function CanvasRoot() {
  const svgRef = useRef<SVGSVGElement>(null);
  const lassoStartRef = useRef<{ x: number; y: number } | null>(null);

  const zoom = useStore((s) => s.zoom);
  const panOffset = useStore((s) => s.panOffset);
  const setZoom = useStore((s) => s.setZoom);
  const setPanOffset = useStore((s) => s.setPanOffset);
  const setLasso = useStore((s) => s.setLasso);
  const lassoRect = useStore((s) => s.lassoRect);
  const clearSelection = useStore((s) => s.clearSelection);
  const addPointsToSelection = useStore((s) => s.addPointsToSelection);
  const addSegmentsToSelection = useStore((s) => s.addSegmentsToSelection);
  const points = useStore((s) => s.points);
  const segments = useStore((s) => s.segments);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!svgRef.current) return null;
      const ctm = svgRef.current.getScreenCTM();
      if (!ctm) return null;
      const inv = ctm.inverse();
      const pt = svgRef.current.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const world = pt.matrixTransform(inv);
      return { x: (world.x - panOffset.x) / zoom, y: (world.y - panOffset.y) / zoom };
    },
    [zoom, panOffset]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(zoom * factor);
    },
    [zoom, setZoom]
  );

  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.target !== svgRef.current && (e.target as SVGElement).tagName !== "rect") {
        // Hit on a child element — let children handle it
        return;
      }

      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        // Middle click or alt+drag = pan
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        return;
      }

      if (e.button === 0) {
        clearSelection();
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) {
          lassoStartRef.current = world;
          setLasso({ x: world.x, y: world.y, w: 0, h: 0 });
        }
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      }
    },
    [panOffset, clientToWorld, clearSelection, setLasso]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isPanning.current && panStart.current) {
        setPanOffset({
          x: panStart.current.ox + (e.clientX - panStart.current.x),
          y: panStart.current.oy + (e.clientY - panStart.current.y),
        });
        return;
      }

      if (lassoStartRef.current) {
        const world = clientToWorld(e.clientX, e.clientY);
        if (world) {
          setLasso({
            x: lassoStartRef.current.x,
            y: lassoStartRef.current.y,
            w: world.x - lassoStartRef.current.x,
            h: world.y - lassoStartRef.current.y,
          });
        }
      }
    },
    [setPanOffset, clientToWorld, setLasso]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isPanning.current) {
        isPanning.current = false;
        panStart.current = null;
        return;
      }

      if (lassoStartRef.current && lassoRect) {
        const lasso = lassoRect as LassoRect;
        const matchedPoints = Object.values(points)
          .filter((p) => pointInLasso({ x: p.x, y: p.y }, lasso))
          .map((p) => p.id);
        const matchedSegments = Object.values(segments)
          .filter((seg) => {
            const ptA = points[seg.pointAId];
            const ptB = points[seg.pointBId];
            return ptA && ptB && segmentInLasso({ x: ptA.x, y: ptA.y }, { x: ptB.x, y: ptB.y }, lasso);
          })
          .map((seg) => seg.id);
        if (matchedPoints.length > 0) addPointsToSelection(matchedPoints);
        if (matchedSegments.length > 0) addSegmentsToSelection(matchedSegments);
      }
      lassoStartRef.current = null;
      setLasso(null);
    },
    [lassoRect, points, segments, addPointsToSelection, addSegmentsToSelection, setLasso]
  );

  const scale = zoom;

  return (
    <svg
      ref={svgRef}
      className="w-full h-full select-none"
      style={{ cursor: "crosshair", background: "var(--surface)" }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <CanvasGrid zoom={zoom} panOffset={panOffset} />
      <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${scale})`}>
        <LayerRenderer />
        <SnapIndicator />
      </g>
      {lassoRect && <SelectionLasso rect={lassoRect} panOffset={panOffset} zoom={zoom} />}
    </svg>
  );
}
