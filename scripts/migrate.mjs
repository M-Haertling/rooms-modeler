/**
 * Runs pending schema migrations against all model databases.
 * Usage:  npm run db:migrate
 *         npm run db:migrate -- path/to/specific.db
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SCHEMA_SQL = fs.readFileSync(path.join(ROOT, "db/schema.sql"), "utf-8");
const MIGRATIONS_DIR = path.join(ROOT, "db/migrations");

const MODELS_DIR =
  process.env.ROOMS_MODELS_DIR ??
  path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", "rooms-models");

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function getExecuted(db) {
  return db
    .prepare("SELECT name FROM migrations ORDER BY id")
    .all()
    .map((r) => r.name);
}

function runMigrations(db, dbPath) {
  const files = getMigrationFiles();
  const executed = new Set(getExecuted(db));
  let ran = 0;

  for (const file of files) {
    if (executed.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    console.log(`  [${path.basename(dbPath)}] Running migration: ${file}`);
    try {
      db.exec(sql);
    } catch (e) {
      if (e.message?.includes("duplicate column")) {
        console.log(`    (column already exists, skipping)`);
      } else {
        throw e;
      }
    }
    db.prepare("INSERT OR IGNORE INTO migrations (name, run_at) VALUES (?, ?)").run(file, Date.now());
    ran++;
  }

  return ran;
}

function openDb(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA_SQL);
  return db;
}

const targetPaths = process.argv[2]
  ? [path.resolve(process.argv[2])]
  : fs.existsSync(MODELS_DIR)
  ? fs.readdirSync(MODELS_DIR)
      .filter((f) => f.endsWith(".db"))
      .map((f) => path.join(MODELS_DIR, f))
  : [];

if (targetPaths.length === 0) {
  console.log("No model databases found.");
  process.exit(0);
}

let totalRan = 0;
for (const dbPath of targetPaths) {
  const db = openDb(dbPath);
  const ran = runMigrations(db, dbPath);
  totalRan += ran;
  if (ran === 0) console.log(`  [${path.basename(dbPath)}] Already up to date.`);
}

console.log(`\nDone. ${totalRan} migration(s) applied across ${targetPaths.length} database(s).`);
