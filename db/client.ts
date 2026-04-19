import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { createMigrator } from "./migrator";

const SCHEMA_SQL = fs.readFileSync(
  path.join(process.cwd(), "db/schema.sql"),
  "utf-8"
);

const clients = new Map<string, DatabaseSync>();
const pending = new Map<string, Promise<DatabaseSync>>();

export async function getDb(dbPath: string): Promise<DatabaseSync> {
  const cached = clients.get(dbPath);
  if (cached) return cached;

  const inFlight = pending.get(dbPath);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const db = new DatabaseSync(dbPath);
    db.exec(SCHEMA_SQL);
    await createMigrator(db).up();
    return db;
  })();

  pending.set(dbPath, promise);
  try {
    const db = await promise;
    clients.set(dbPath, db);
    return db;
  } finally {
    pending.delete(dbPath);
  }
}

export function resolveModelPath(modelId: string): string {
  const base = process.env.ROOMS_MODELS_DIR ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", "rooms-models");
  return path.join(base, `${modelId}.db`);
}

export function resolveAssetsDir(modelId: string): string {
  const base = process.env.ROOMS_MODELS_DIR ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", "rooms-models");
  return path.join(base, `${modelId}-assets`);
}
