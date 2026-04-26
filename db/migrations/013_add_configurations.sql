CREATE TABLE IF NOT EXISTS layer_configurations (
  id          TEXT PRIMARY KEY,
  layer_id    TEXT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS configuration_point_positions (
  configuration_id  TEXT NOT NULL REFERENCES layer_configurations(id) ON DELETE CASCADE,
  point_id          TEXT NOT NULL REFERENCES points(id) ON DELETE CASCADE,
  x                 REAL NOT NULL,
  y                 REAL NOT NULL,
  PRIMARY KEY (configuration_id, point_id)
);

CREATE TABLE IF NOT EXISTS configuration_object_rotations (
  configuration_id  TEXT NOT NULL REFERENCES layer_configurations(id) ON DELETE CASCADE,
  object_id         TEXT NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  rotation          REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (configuration_id, object_id)
);

ALTER TABLE layers ADD COLUMN active_configuration_id TEXT
  REFERENCES layer_configurations(id) ON DELETE SET NULL;

ALTER TABLE points ADD COLUMN square_mode INTEGER NOT NULL DEFAULT 0;
