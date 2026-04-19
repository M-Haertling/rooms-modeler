import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const SCHEMA_SQL = fs.readFileSync(
  path.join(process.cwd(), "db/schema.sql"),
  "utf-8"
);

const clients = new Map<string, DatabaseSync>();

export function getDb(dbPath: string): DatabaseSync {
  const existing = clients.get(dbPath);
  if (existing) return existing;

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA_SQL);
  clients.set(dbPath, db);
  return db;
}

export function resolveModelPath(modelId: string): string {
  const base = process.env.ROOMS_MODELS_DIR ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", "rooms-models");
  return path.join(base, `${modelId}.db`);
}

export function resolveAssetsDir(modelId: string): string {
  const base = process.env.ROOMS_MODELS_DIR ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", "rooms-models");
  return path.join(base, `${modelId}-assets`);
}
