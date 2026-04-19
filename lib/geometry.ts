import type { Vec2 } from "@/types/canvas";

export function distance(a: Vec2, b: Vec2): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function rotatePoint(point: Vec2, center: Vec2, angleDeg: number): Vec2 {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function boundingBox(points: Vec2[]): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number; cx: number; cy: number } {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, cx: 0, cy: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

export function snapCheck(
  point: Vec2,
  candidates: { id: string; pos: Vec2 }[],
  threshold: number
): { id: string; pos: Vec2 } | null {
  let closest: { id: string; pos: Vec2 } | null = null;
  let closestDist = threshold;
  for (const c of candidates) {
    const d = distance(point, c.pos);
    if (d < closestDist) {
      closestDist = d;
      closest = c;
    }
  }
  return closest;
}

export function constrainToLockedSegment(
  newPos: Vec2,
  anchorPos: Vec2,
  lockedLength: number
): Vec2 {
  const dir = subtract(newPos, anchorPos);
  const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
  if (len === 0) return { x: anchorPos.x + lockedLength, y: anchorPos.y };
  return add(anchorPos, scale(normalize(dir), lockedLength));
}
