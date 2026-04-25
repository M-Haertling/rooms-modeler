PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS project (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'feet',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS object_types (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS layers (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  parent_id   TEXT REFERENCES layers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  hidden      INTEGER NOT NULL DEFAULT 0,
  sort_order  REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS objects (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  layer_id        TEXT REFERENCES layers(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  object_type_id  TEXT REFERENCES object_types(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL DEFAULT 'standard',
  line_color      TEXT NOT NULL DEFAULT '#ffffff',
  fill_color      TEXT NOT NULL DEFAULT '#e8e8f0',
  fill_enabled    INTEGER NOT NULL DEFAULT 0,
  line_thickness  REAL NOT NULL DEFAULT 1.5,
  locked          INTEGER NOT NULL DEFAULT 0,
  owned           INTEGER NOT NULL DEFAULT 0,
  cost            REAL,
  url             TEXT,
  notes           TEXT,
  height_3d       REAL,
  custom_dims     TEXT,
  rotation        REAL NOT NULL DEFAULT 0,
  sort_order      REAL NOT NULL DEFAULT 0,
  fill_opacity    REAL NOT NULL DEFAULT 1.0,
  hidden          INTEGER NOT NULL DEFAULT 0,
  show_name       INTEGER NOT NULL DEFAULT 0,
  parent_object_id TEXT REFERENCES objects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS points (
  id          TEXT PRIMARY KEY,
  object_id   TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  x           REAL NOT NULL,
  y           REAL NOT NULL,
  locked      INTEGER NOT NULL DEFAULT 0,
  snapping    INTEGER NOT NULL DEFAULT 1,
  sort_order  REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS segments (
  id          TEXT PRIMARY KEY,
  object_id   TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  point_a_id  TEXT NOT NULL REFERENCES points(id) ON DELETE CASCADE,
  point_b_id  TEXT NOT NULL REFERENCES points(id) ON DELETE CASCADE,
  name        TEXT,
  locked      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS object_images (
  id          TEXT PRIMARY KEY,
  object_id   TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  file_path   TEXT NOT NULL,
  label       TEXT,
  sort_order  REAL NOT NULL DEFAULT 0,
  is_primary  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS templates (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'standard',
  normalized_data TEXT NOT NULL,
  thumbnail_svg   TEXT,
  line_color      TEXT NOT NULL DEFAULT '#1a1a2e',
  fill_color      TEXT NOT NULL DEFAULT '#e8e8f0',
  line_thickness  REAL NOT NULL DEFAULT 1.5,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS migrations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  run_at    INTEGER NOT NULL
);

