import type { Vec2 } from "@/types/canvas";

export interface LassoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function pointInLasso(point: Vec2, lasso: LassoRect): boolean {
  const minX = lasso.w >= 0 ? lasso.x : lasso.x + lasso.w;
  const maxX = lasso.w >= 0 ? lasso.x + lasso.w : lasso.x;
  const minY = lasso.h >= 0 ? lasso.y : lasso.y + lasso.h;
  const maxY = lasso.h >= 0 ? lasso.y + lasso.h : lasso.y;
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

// A segment is in the lasso if its midpoint falls within the rect.
export function segmentInLasso(ptA: Vec2, ptB: Vec2, lasso: LassoRect): boolean {
  return pointInLasso({ x: (ptA.x + ptB.x) / 2, y: (ptA.y + ptB.y) / 2 }, lasso);
}
