ALTER TABLE segments ADD COLUMN segment_type TEXT NOT NULL DEFAULT 'solid';
UPDATE segments SET segment_type = 'door' WHERE door = 1;
