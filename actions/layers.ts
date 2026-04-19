"use server";

import { nanoid } from "nanoid";
import { getDb, resolveModelPath } from "@/db/client";
import type { CanvasLayer } from "@/types/canvas";

type DbRow = Record<string, unknown>;

function rowToLayer(r: DbRow): CanvasLayer {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    parentId: (r.parent_id as string | null) ?? null,
    name: r.name as string,
    hidden: Boolean(r.hidden),
    sortOrder: r.sort_order as number,
  };
}

export async function createLayer(
  modelId: string,
  projectId: string,
  name: string,
  parentId: string | null = null
): Promise<CanvasLayer> {
  const db = await getDb(resolveModelPath(modelId));
  const id = nanoid();
  db.prepare(
    "INSERT INTO layers (id, project_id, parent_id, name, sort_order) VALUES (?, ?, ?, ?, ?)"
  ).run(id, projectId, parentId, name, Date.now());
  return { id, projectId, parentId, name, hidden: false, sortOrder: Date.now() };
}

export async function updateLayer(
  modelId: string,
  layerId: string,
  fields: { name?: string; hidden?: boolean; parentId?: string | null; sortOrder?: number }
): Promise<void> {
  const db = await getDb(resolveModelPath(modelId));
  if (fields.name !== undefined)
    db.prepare("UPDATE layers SET name = ? WHERE id = ?").run(fields.name, layerId);
  if (fields.hidden !== undefined)
    db.prepare("UPDATE layers SET hidden = ? WHERE id = ?").run(fields.hidden ? 1 : 0, layerId);
  if (fields.parentId !== undefined)
    db.prepare("UPDATE layers SET parent_id = ? WHERE id = ?").run(fields.parentId, layerId);
  if (fields.sortOrder !== undefined)
    db.prepare("UPDATE layers SET sort_order = ? WHERE id = ?").run(fields.sortOrder, layerId);
}

export async function deleteLayer(modelId: string, layerId: string): Promise<void> {
  const db = await getDb(resolveModelPath(modelId));
  db.prepare("UPDATE objects SET layer_id = NULL WHERE layer_id = ?").run(layerId);
  db.prepare("DELETE FROM layers WHERE id = ?").run(layerId);
}

export async function moveObjectToLayer(
  modelId: string,
  objectId: string,
  layerId: string | null
): Promise<void> {
  const db = await getDb(resolveModelPath(modelId));
  db.prepare("UPDATE objects SET layer_id = ? WHERE id = ?").run(layerId, objectId);
}
