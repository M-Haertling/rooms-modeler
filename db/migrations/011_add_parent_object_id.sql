ALTER TABLE objects ADD COLUMN parent_object_id TEXT REFERENCES objects(id) ON DELETE SET NULL;
