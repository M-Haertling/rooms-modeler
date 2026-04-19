import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Umzug } from "umzug";
import type { DatabaseSync } from "node:sqlite";

const MIGRATIONS_DIR = path.join(process.cwd(), "db/migrations");

export function createMigrator(db: DatabaseSync) {
  return new Umzug({
    migrations: {
      glob: path.join(MIGRATIONS_DIR, "*.sql").replace(/\\/g, "/"),
      resolve: ({ name, path: filePath }) => ({
        name,
        up: async () => {
          const sql = fs.readFileSync(filePath!, "utf-8");
          try {
            db.exec(sql);
          } catch (e: unknown) {
            // Swallow "duplicate column" errors so migrations are idempotent
            // on databases that had columns added via the old try/catch approach.
            if (e instanceof Error && e.message.includes("duplicate column")) return;
            throw e;
          }
        },
      }),
    },
    storage: {
      logMigration: async ({ name }) => {
        db.prepare("INSERT OR IGNORE INTO migrations (name, run_at) VALUES (?, ?)").run(name, Date.now());
      },
      unlogMigration: async ({ name }) => {
        db.prepare("DELETE FROM migrations WHERE name = ?").run(name);
      },
      executed: async () => {
        return (
          db.prepare("SELECT name FROM migrations ORDER BY id").all() as { name: string }[]
        ).map((r) => r.name);
      },
    },
    logger: undefined,
  });
}
