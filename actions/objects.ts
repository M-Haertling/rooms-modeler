"use server";

import { getDb, resolveModelPath } from "@/db/client";
import {
  dbLoadProjectData,
  dbCreateObject,
  dbUpdatePoint,
  dbUpdatePointFields,
  dbUpdateObject,
  dbDeleteObject,
  dbUpdateSegment,
  dbSplitSegment,
  dbDuplicateObject,
} from "@/db/objects-repo";
import type { CanvasObject, CanvasPoint, CanvasSegment } from "@/types/canvas";

export async function loadProjectData(modelId: string) {
  return dbLoadProjectData(getDb(resolveModelPath(modelId)));
}

export async function createObject(
  modelId: string,
  params: {
    projectId: string;
    layerId: string | null;
    kind: "standard" | "round";
    name: string;
    points: { x: number; y: number }[];
  }
): Promise<{ object: CanvasObject; points: CanvasPoint[]; segments: CanvasSegment[] }> {
  return dbCreateObject(getDb(resolveModelPath(modelId)), params);
}

export async function updatePoint(
  modelId: string,
  pointId: string,
  x: number,
  y: number
): Promise<void> {
  dbUpdatePoint(getDb(resolveModelPath(modelId)), pointId, x, y);
}

export async function updateObject(
  modelId: string,
  objectId: string,
  fields: Partial<Omit<CanvasObject, "id" | "projectId" | "kind">>
): Promise<void> {
  dbUpdateObject(getDb(resolveModelPath(modelId)), objectId, fields);
}

export async function deleteObject(modelId: string, objectId: string): Promise<void> {
  dbDeleteObject(getDb(resolveModelPath(modelId)), objectId);
}

export async function updatePoint2(
  modelId: string,
  pointId: string,
  fields: { locked?: boolean; snapping?: boolean }
): Promise<void> {
  dbUpdatePointFields(getDb(resolveModelPath(modelId)), pointId, fields);
}

export async function updateSegment(
  modelId: string,
  segmentId: string,
  fields: { name?: string | null; locked?: boolean }
): Promise<void> {
  dbUpdateSegment(getDb(resolveModelPath(modelId)), segmentId, fields);
}

export async function splitSegment(
  modelId: string,
  segmentId: string
): Promise<{ newPoint: CanvasPoint; segmentA: CanvasSegment; segmentB: CanvasSegment } | null> {
  return dbSplitSegment(getDb(resolveModelPath(modelId)), segmentId);
}

export async function duplicateObject(
  modelId: string,
  objectId: string,
  offsetX = 0.5,
  offsetY = 0.5
): Promise<{ object: CanvasObject; points: CanvasPoint[]; segments: CanvasSegment[] }> {
  return dbDuplicateObject(getDb(resolveModelPath(modelId)), objectId, offsetX, offsetY);
}
