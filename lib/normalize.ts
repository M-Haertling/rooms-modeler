import type { CanvasPoint, CanvasSegment, NormalizedTemplateData } from "@/types/canvas";
import { boundingBox } from "./geometry";

export function normalizeObject(
  points: CanvasPoint[],
  segments: CanvasSegment[]
): NormalizedTemplateData {
  const bbox = boundingBox(points.map((p) => ({ x: p.x, y: p.y })));
  const w = bbox.width || 1;
  const h = bbox.height || 1;

  return {
    points: points.map((p) => ({
      id: p.id,
      x: (p.x - bbox.minX) / w,
      y: (p.y - bbox.minY) / h,
      sortOrder: p.sortOrder,
    })),
    segments: segments.map((s) => ({
      id: s.id,
      pointAId: s.pointAId,
      pointBId: s.pointBId,
      name: s.name,
    })),
  };
}

export function instantiateTemplate(
  data: NormalizedTemplateData,
  width: number,
  height: number,
  originX: number,
  originY: number
) {
  return {
    points: data.points.map((p) => ({
      ...p,
      x: originX + p.x * width,
      y: originY + p.y * height,
    })),
    segments: data.segments,
  };
}
