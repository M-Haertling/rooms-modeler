"use server";

import { nanoid } from "nanoid";
import { getDb, resolveModelPath } from "@/db/client";
import type { LayerConfiguration } from "@/types/canvas";
import {
  dbCreateConfiguration,
  dbDeleteConfiguration,
  dbRenameConfiguration,
  dbSetLayerActiveConfiguration,
  dbApplyConfiguration,
  dbSaveConfiguration,
} from "@/db/objects-repo";

export async function createConfiguration(
  modelId: string,
  layerId: string,
  name: string
): Promise<LayerConfiguration> {
  const db = await getDb(resolveModelPath(modelId));

  // Snapshot current positions of all objects directly in this layer
  const objects = db.prepare(
    "SELECT id, rotation FROM objects WHERE layer_id = ?"
  ).all(layerId) as { id: string; rotation: number }[];

  const objectIds = objects.map((o) => o.id);
  const pointPositions: { id: string; x: number; y: number }[] = objectIds.length > 0
    ? (db.prepare(
        `SELECT id, x, y FROM points WHERE object_id IN (${objectIds.map(() => "?").join(",")})`
      ).all(...objectIds) as { id: string; x: number; y: number }[])
    : [];

  const sortOrder = Date.now();
  const config: LayerConfiguration = { id: nanoid(), layerId, name, sortOrder };

  dbCreateConfiguration(db, config, pointPositions, objects);
  dbSetLayerActiveConfiguration(db, layerId, config.id);

  return config;
}

export async function deleteConfiguration(
  modelId: string,
  configId: string,
  layerId: string
): Promise<void> {
  const db = await getDb(resolveModelPath(modelId));
  const layer = db.prepare("SELECT active_configuration_id FROM layers WHERE id = ?").get(layerId) as { active_configuration_id: string | null } | undefined;
  dbDeleteConfiguration(db, configId);
  if (layer?.active_configuration_id === configId) {
    dbSetLayerActiveConfiguration(db, layerId, null);
  }
}

export async function renameConfiguration(
  modelId: string,
  configId: string,
  name: string
): Promise<void> {
  const db = await getDb(resolveModelPath(modelId));
  dbRenameConfiguration(db, configId, name);
}

export async function applyConfiguration(
  modelId: string,
  layerId: string,
  configId: string
): Promise<{ points: { id: string; x: number; y: number }[]; objects: { id: string; rotation: number }[] }> {
  const db = await getDb(resolveModelPath(modelId));
  const snapshot = dbApplyConfiguration(db, configId);

  // Apply positions to DB
  const updatePoint = db.prepare("UPDATE points SET x = ?, y = ? WHERE id = ?");
  const updateObj = db.prepare("UPDATE objects SET rotation = ? WHERE id = ?");

  db.exec("BEGIN");
  try {
    for (const p of snapshot.points) updatePoint.run(p.x, p.y, p.id);
    for (const o of snapshot.objects) updateObj.run(o.rotation, o.id);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  dbSetLayerActiveConfiguration(db, layerId, configId);
  return snapshot;
}

export async function saveConfiguration(
  modelId: string,
  configId: string,
  layerId: string
): Promise<void> {
  const db = await getDb(resolveModelPath(modelId));

  const objects = db.prepare(
    "SELECT id, rotation FROM objects WHERE layer_id = ?"
  ).all(layerId) as { id: string; rotation: number }[];

  const objectIds = objects.map((o) => o.id);
  const pointPositions: { id: string; x: number; y: number }[] = objectIds.length > 0
    ? (db.prepare(
        `SELECT id, x, y FROM points WHERE object_id IN (${objectIds.map(() => "?").join(",")})`
      ).all(...objectIds) as { id: string; x: number; y: number }[])
    : [];

  dbSaveConfiguration(db, configId, pointPositions, objects);
}
