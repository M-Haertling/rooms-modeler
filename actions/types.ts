"use server";

import { nanoid } from "nanoid";
import { getDb, resolveModelPath } from "@/db/client";
import type { ObjectType } from "@/types/canvas";

type DbRow = Record<string, unknown>;

export async function createObjectType(modelId: string, projectId: string, name: string): Promise<ObjectType> {
  const db = getDb(resolveModelPath(modelId));
  const id = nanoid();
  db.prepare("INSERT INTO object_types (id, project_id, name) VALUES (?, ?, ?)").run(id, projectId, name);
  return { id, projectId, name };
}

export async function updateObjectType(modelId: string, typeId: string, name: string): Promise<void> {
  const db = getDb(resolveModelPath(modelId));
  db.prepare("UPDATE object_types SET name = ? WHERE id = ?").run(name, typeId);
}

export async function deleteObjectType(modelId: string, typeId: string): Promise<void> {
  const db = getDb(resolveModelPath(modelId));
  db.prepare("UPDATE objects SET object_type_id = NULL WHERE object_type_id = ?").run(typeId);
  db.prepare("DELETE FROM object_types WHERE id = ?").run(typeId);
}
