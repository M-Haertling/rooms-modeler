"use server";

import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { getDb, resolveModelPath } from "@/db/client";
import type { ModelFile, Project, Unit } from "@/types/canvas";

function modelsDir(): string {
  return (
    process.env.ROOMS_MODELS_DIR ??
    path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", "rooms-models")
  );
}

export async function listModels(): Promise<ModelFile[]> {
  const dir = modelsDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".db"));
  return files.map((f) => {
    const id = f.replace(/\.db$/, "");
    const stat = fs.statSync(path.join(dir, f));
    const dbPath = path.join(dir, f);
    try {
      const db = getDb(dbPath);
      const row = db.prepare("SELECT name FROM project LIMIT 1").get() as { name: string } | undefined;
      return { id, name: row?.name ?? id, path: dbPath, updatedAt: stat.mtimeMs };
    } catch {
      return { id, name: id, path: dbPath, updatedAt: stat.mtimeMs };
    }
  });
}

export async function createModel(name: string): Promise<string> {
  const id = nanoid(10);
  const dbPath = resolveModelPath(id);
  const db = getDb(dbPath);
  const now = Date.now();
  db.prepare(
    "INSERT INTO project (id, name, unit, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(nanoid(), name, "feet", now, now);
  return id;
}

export async function getProject(modelId: string): Promise<Project | null> {
  const db = getDb(resolveModelPath(modelId));
  const row = db.prepare("SELECT * FROM project LIMIT 1").get() as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    name: row.name as string,
    unit: row.unit as Unit,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export async function updateProjectUnit(modelId: string, unit: Unit): Promise<void> {
  const db = getDb(resolveModelPath(modelId));
  db.prepare("UPDATE project SET unit = ?, updated_at = ? WHERE 1").run(unit, Date.now());
}

export async function renameProject(modelId: string, name: string): Promise<void> {
  const db = getDb(resolveModelPath(modelId));
  db.prepare("UPDATE project SET name = ?, updated_at = ? WHERE 1").run(name, Date.now());
}
