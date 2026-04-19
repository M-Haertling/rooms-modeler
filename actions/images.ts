"use server";

import { nanoid } from "nanoid";
import fs from "node:fs";
import path from "node:path";
import { getDb, resolveModelPath, resolveAssetsDir } from "@/db/client";
import type { ObjectImage } from "@/types/canvas";

type DbRow = Record<string, unknown>;

function rowToImage(r: DbRow): ObjectImage {
  return {
    id: r.id as string,
    objectId: r.object_id as string,
    filePath: r.file_path as string,
    label: (r.label as string | null) ?? null,
    sortOrder: r.sort_order as number,
    isPrimary: Boolean(r.is_primary),
  };
}

export async function getObjectImages(modelId: string, objectId: string): Promise<ObjectImage[]> {
  const db = getDb(resolveModelPath(modelId));
  return (db.prepare("SELECT * FROM object_images WHERE object_id = ? ORDER BY sort_order").all(objectId) as DbRow[]).map(rowToImage);
}

export async function uploadObjectImage(
  modelId: string,
  objectId: string,
  filename: string,
  data: Buffer
): Promise<ObjectImage> {
  const assetsDir = resolveAssetsDir(modelId);
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const ext = path.extname(filename);
  const id = nanoid();
  const storedName = `${id}${ext}`;
  const filePath = storedName;
  fs.writeFileSync(path.join(assetsDir, storedName), data);

  const db = getDb(resolveModelPath(modelId));
  const count = (db.prepare("SELECT COUNT(*) as c FROM object_images WHERE object_id = ?").get(objectId) as { c: number }).c;

  db.prepare(
    "INSERT INTO object_images (id, object_id, file_path, sort_order, is_primary) VALUES (?, ?, ?, ?, ?)"
  ).run(id, objectId, filePath, count * 1000, count === 0 ? 1 : 0);

  return rowToImage(db.prepare("SELECT * FROM object_images WHERE id = ?").get(id) as DbRow);
}

export async function setPrimaryImage(modelId: string, imageId: string, objectId: string): Promise<void> {
  const db = getDb(resolveModelPath(modelId));
  db.prepare("UPDATE object_images SET is_primary = 0 WHERE object_id = ?").run(objectId);
  db.prepare("UPDATE object_images SET is_primary = 1 WHERE id = ?").run(imageId);
}

export async function deleteImage(modelId: string, imageId: string): Promise<void> {
  const db = getDb(resolveModelPath(modelId));
  const row = db.prepare("SELECT * FROM object_images WHERE id = ?").get(imageId) as DbRow | undefined;
  if (!row) return;

  const assetsDir = resolveAssetsDir(modelId);
  const fullPath = path.join(assetsDir, row.file_path as string);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  db.prepare("DELETE FROM object_images WHERE id = ?").run(imageId);
}
