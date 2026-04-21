import type { DatabaseSync } from "node:sqlite";
import { nanoid } from "nanoid";
import type { CanvasObject, CanvasPoint, CanvasSegment, CanvasLayer, ObjectType } from "@/types/canvas";

type DbRow = Record<string, unknown>;
type SQLVal = null | bigint | number | string | Uint8Array;
function v(x: unknown): SQLVal { return x as SQLVal; }

export function rowToObject(r: DbRow): CanvasObject {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    layerId: (r.layer_id as string | null) ?? null,
    name: r.name as string,
    objectTypeId: (r.object_type_id as string | null) ?? null,
    kind: r.kind as "standard" | "round",
    lineColor: r.line_color as string,
    fillColor: r.fill_color as string,
    lineThickness: r.line_thickness as number,
    locked: Boolean(r.locked),
    owned: Boolean(r.owned),
    cost: (r.cost as number | null) ?? null,
    url: (r.url as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    height3d: (r.height_3d as number | null) ?? null,
    customDims: r.custom_dims ? JSON.parse(r.custom_dims as string) : [],
    rotation: r.rotation as number,
    sortOrder: r.sort_order as number,
    showDimensions: Boolean(r.show_dimensions),
    fillEnabled: r.fill_enabled === undefined ? true : Boolean(r.fill_enabled),
  };
}

export function rowToPoint(r: DbRow): CanvasPoint {
  return {
    id: r.id as string,
    objectId: r.object_id as string,
    x: r.x as number,
    y: r.y as number,
    xLocked: Boolean(r.x_locked),
    yLocked: Boolean(r.y_locked),
    angleLocked: Boolean(r.angle_locked),
    snapping: Boolean(r.snapping),
    sortOrder: r.sort_order as number,
  };
}

export function rowToSegment(r: DbRow): CanvasSegment {
  return {
    id: r.id as string,
    objectId: r.object_id as string,
    pointAId: r.point_a_id as string,
    pointBId: r.point_b_id as string,
    name: (r.name as string | null) ?? null,
    locked: Boolean(r.locked),
    angleLocked: Boolean(r.angle_locked),
    transparent: Boolean(r.transparent),
    showDimensions: Boolean(r.show_dimensions),
    segmentType: (r.segment_type === "door" || r.segment_type === "window")
      ? r.segment_type as "door" | "window"
      : Boolean(r.door) ? "door" : "solid",
    doorSwingIn: r.door_swing_in !== undefined ? Boolean(r.door_swing_in) : true,
    doorHingeSide: (r.door_hinge_side as string) === "right" ? "right" : "left",
  };
}

export function rowToLayer(r: DbRow): CanvasLayer {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    parentId: (r.parent_id as string | null) ?? null,
    name: r.name as string,
    hidden: Boolean(r.hidden),
    sortOrder: r.sort_order as number,
  };
}

export function dbLoadProjectData(db: DatabaseSync) {
  const objects = (db.prepare("SELECT * FROM objects ORDER BY sort_order").all() as DbRow[]).map(rowToObject);
  const points = (db.prepare("SELECT * FROM points ORDER BY sort_order").all() as DbRow[]).map(rowToPoint);
  const segments = (db.prepare("SELECT * FROM segments").all() as DbRow[]).map(rowToSegment);
  const layers = (db.prepare("SELECT * FROM layers ORDER BY sort_order").all() as DbRow[]).map(rowToLayer);
  const objectTypes = (db.prepare("SELECT * FROM object_types").all() as DbRow[]).map((r) => ({
    id: r.id as string,
    projectId: r.project_id as string,
    name: r.name as string,
  })) as ObjectType[];
  return { objects, points, segments, layers, objectTypes };
}

export function dbCreateObject(
  db: DatabaseSync,
  params: {
    projectId: string;
    layerId: string | null;
    kind: "standard" | "round";
    name: string;
    points: { x: number; y: number }[];
  }
): { object: CanvasObject; points: CanvasPoint[]; segments: CanvasSegment[] } {
  const objId = nanoid();
  const now = Date.now();

  db.prepare(
    `INSERT INTO objects (id, project_id, layer_id, name, kind, line_color, fill_enabled, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(objId, params.projectId, params.layerId, params.name, params.kind, "#ffffff", 0, now);

  const createdPoints: CanvasPoint[] = [];
  for (let i = 0; i < params.points.length; i++) {
    const pid = nanoid();
    db.prepare(
      "INSERT INTO points (id, object_id, x, y, sort_order) VALUES (?, ?, ?, ?, ?)"
    ).run(pid, objId, params.points[i].x, params.points[i].y, i * 1000);
    createdPoints.push({ id: pid, objectId: objId, x: params.points[i].x, y: params.points[i].y, xLocked: false, yLocked: false, angleLocked: false, snapping: true, sortOrder: i * 1000 });
  }

  const createdSegments: CanvasSegment[] = [];
  if (params.kind === "standard" && createdPoints.length >= 2) {
    for (let i = 0; i < createdPoints.length; i++) {
      const a = createdPoints[i];
      const b = createdPoints[(i + 1) % createdPoints.length];
      const sid = nanoid();
      db.prepare(
        "INSERT INTO segments (id, object_id, point_a_id, point_b_id) VALUES (?, ?, ?, ?)"
      ).run(sid, objId, a.id, b.id);
      createdSegments.push({ id: sid, objectId: objId, pointAId: a.id, pointBId: b.id, name: null, locked: false, angleLocked: false, transparent: false, showDimensions: false, segmentType: "solid", doorSwingIn: true, doorHingeSide: "left" });
    }
  }

  const objRow = db.prepare("SELECT * FROM objects WHERE id = ?").get(objId) as DbRow;
  return { object: rowToObject(objRow), points: createdPoints, segments: createdSegments };
}

export function dbUpdatePoint(
  db: DatabaseSync,
  pointId: string,
  x: number,
  y: number
): void {
  db.prepare("UPDATE points SET x = ?, y = ? WHERE id = ?").run(x, y, pointId);
}

export function dbUpdatePointFields(
  db: DatabaseSync,
  pointId: string,
  fields: { xLocked?: boolean; yLocked?: boolean; angleLocked?: boolean; snapping?: boolean }
): void {
  if (fields.xLocked !== undefined)
    db.prepare("UPDATE points SET x_locked = ? WHERE id = ?").run(fields.xLocked ? 1 : 0, pointId);
  if (fields.yLocked !== undefined)
    db.prepare("UPDATE points SET y_locked = ? WHERE id = ?").run(fields.yLocked ? 1 : 0, pointId);
  if (fields.angleLocked !== undefined)
    db.prepare("UPDATE points SET angle_locked = ? WHERE id = ?").run(fields.angleLocked ? 1 : 0, pointId);
  if (fields.snapping !== undefined)
    db.prepare("UPDATE points SET snapping = ? WHERE id = ?").run(fields.snapping ? 1 : 0, pointId);
}

export function dbUpdateObject(
  db: DatabaseSync,
  objectId: string,
  fields: Partial<Omit<CanvasObject, "id" | "projectId" | "kind">>
): void {
  const updates: string[] = [];
  const values: SQLVal[] = [];

  if (fields.name !== undefined) { updates.push("name = ?"); values.push(fields.name); }
  if (fields.layerId !== undefined) { updates.push("layer_id = ?"); values.push(fields.layerId); }
  if (fields.objectTypeId !== undefined) { updates.push("object_type_id = ?"); values.push(fields.objectTypeId); }
  if (fields.lineColor !== undefined) { updates.push("line_color = ?"); values.push(fields.lineColor); }
  if (fields.fillColor !== undefined) { updates.push("fill_color = ?"); values.push(fields.fillColor); }
  if (fields.lineThickness !== undefined) { updates.push("line_thickness = ?"); values.push(fields.lineThickness); }
  if (fields.locked !== undefined) { updates.push("locked = ?"); values.push(fields.locked ? 1 : 0); }
  if (fields.owned !== undefined) { updates.push("owned = ?"); values.push(fields.owned ? 1 : 0); }
  if (fields.cost !== undefined) { updates.push("cost = ?"); values.push(fields.cost); }
  if (fields.url !== undefined) { updates.push("url = ?"); values.push(fields.url); }
  if (fields.notes !== undefined) { updates.push("notes = ?"); values.push(fields.notes); }
  if (fields.height3d !== undefined) { updates.push("height_3d = ?"); values.push(fields.height3d); }
  if (fields.customDims !== undefined) { updates.push("custom_dims = ?"); values.push(JSON.stringify(fields.customDims)); }
  if (fields.rotation !== undefined) { updates.push("rotation = ?"); values.push(fields.rotation); }
  if (fields.sortOrder !== undefined) { updates.push("sort_order = ?"); values.push(fields.sortOrder); }
  if (fields.showDimensions !== undefined) { updates.push("show_dimensions = ?"); values.push(fields.showDimensions ? 1 : 0); }
  if (fields.fillEnabled !== undefined) { updates.push("fill_enabled = ?"); values.push(fields.fillEnabled ? 1 : 0); }

  if (updates.length === 0) return;
  values.push(objectId);
  db.prepare(`UPDATE objects SET ${updates.join(", ")} WHERE id = ?`).run(...values);
}

export function dbDeleteObject(db: DatabaseSync, objectId: string): void {
  db.prepare("DELETE FROM objects WHERE id = ?").run(objectId);
}

export function dbUpdateSegment(
  db: DatabaseSync,
  segmentId: string,
  fields: { name?: string | null; locked?: boolean; angleLocked?: boolean; transparent?: boolean; showDimensions?: boolean; segmentType?: "solid" | "door" | "window"; doorSwingIn?: boolean; doorHingeSide?: "left" | "right" }
): void {
  if (fields.name !== undefined)
    db.prepare("UPDATE segments SET name = ? WHERE id = ?").run(fields.name, segmentId);
  if (fields.locked !== undefined)
    db.prepare("UPDATE segments SET locked = ? WHERE id = ?").run(fields.locked ? 1 : 0, segmentId);
  if (fields.angleLocked !== undefined)
    db.prepare("UPDATE segments SET angle_locked = ? WHERE id = ?").run(fields.angleLocked ? 1 : 0, segmentId);
  if (fields.transparent !== undefined)
    db.prepare("UPDATE segments SET transparent = ? WHERE id = ?").run(fields.transparent ? 1 : 0, segmentId);
  if (fields.showDimensions !== undefined)
    db.prepare("UPDATE segments SET show_dimensions = ? WHERE id = ?").run(fields.showDimensions ? 1 : 0, segmentId);
  if (fields.segmentType !== undefined) {
    db.prepare("UPDATE segments SET segment_type = ? WHERE id = ?").run(fields.segmentType, segmentId);
    db.prepare("UPDATE segments SET door = ? WHERE id = ?").run(fields.segmentType === "door" ? 1 : 0, segmentId);
  }
  if (fields.doorSwingIn !== undefined)
    db.prepare("UPDATE segments SET door_swing_in = ? WHERE id = ?").run(fields.doorSwingIn ? 1 : 0, segmentId);
  if (fields.doorHingeSide !== undefined)
    db.prepare("UPDATE segments SET door_hinge_side = ? WHERE id = ?").run(fields.doorHingeSide, segmentId);
}

export function dbSplitSegment(
  db: DatabaseSync,
  segmentId: string
): { newPoint: CanvasPoint; segmentA: CanvasSegment; segmentB: CanvasSegment } | null {
  const seg = db.prepare("SELECT * FROM segments WHERE id = ?").get(segmentId) as DbRow | undefined;
  if (!seg) return null;

  const ptA = db.prepare("SELECT * FROM points WHERE id = ?").get(seg.point_a_id as string) as DbRow;
  const ptB = db.prepare("SELECT * FROM points WHERE id = ?").get(seg.point_b_id as string) as DbRow;

  const mx = ((ptA.x as number) + (ptB.x as number)) / 2;
  const my = ((ptA.y as number) + (ptB.y as number)) / 2;
  const newSortOrder = ((ptA.sort_order as number) + (ptB.sort_order as number)) / 2;
  const midId = nanoid();
  const sidA = nanoid();
  const sidB = nanoid();

  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO points (id, object_id, x, y, sort_order) VALUES (?, ?, ?, ?, ?)").run(midId, v(seg.object_id), mx, my, newSortOrder);
    db.prepare("DELETE FROM segments WHERE id = ?").run(segmentId);
    db.prepare("INSERT INTO segments (id, object_id, point_a_id, point_b_id) VALUES (?, ?, ?, ?)").run(sidA, v(seg.object_id), v(seg.point_a_id), midId);
    db.prepare("INSERT INTO segments (id, object_id, point_a_id, point_b_id) VALUES (?, ?, ?, ?)").run(sidB, v(seg.object_id), midId, v(seg.point_b_id));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  return {
    newPoint: { id: midId, objectId: seg.object_id as string, x: mx, y: my, xLocked: false, yLocked: false, angleLocked: false, snapping: true, sortOrder: newSortOrder },
    segmentA: { id: sidA, objectId: seg.object_id as string, pointAId: seg.point_a_id as string, pointBId: midId, name: null, locked: false, angleLocked: false, transparent: false, showDimensions: false, segmentType: "solid", doorSwingIn: true, doorHingeSide: "left" },
    segmentB: { id: sidB, objectId: seg.object_id as string, pointAId: midId, pointBId: seg.point_b_id as string, name: null, locked: false, angleLocked: false, transparent: false, showDimensions: false, segmentType: "solid", doorSwingIn: true, doorHingeSide: "left" },
  };
}

export function dbDeletePoint(
  db: DatabaseSync,
  pointId: string
): { newSegment: CanvasSegment | null } {
  const pt = db.prepare("SELECT object_id FROM points WHERE id = ?").get(pointId) as DbRow | undefined;
  if (!pt) return { newSegment: null };

  const segs = db.prepare("SELECT * FROM segments WHERE point_a_id = ? OR point_b_id = ?").all(pointId, pointId) as DbRow[];
  const neighborIds = segs.map((s) => (s.point_a_id as string) === pointId ? (s.point_b_id as string) : (s.point_a_id as string));

  let newSegment: CanvasSegment | null = null;

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM points WHERE id = ?").run(pointId);
    if (neighborIds.length === 2 && neighborIds[0] !== neighborIds[1]) {
      const sid = nanoid();
      const [a, b] = neighborIds;
      db.prepare("INSERT INTO segments (id, object_id, point_a_id, point_b_id) VALUES (?, ?, ?, ?)").run(sid, pt.object_id as string, a, b);
      newSegment = { id: sid, objectId: pt.object_id as string, pointAId: a, pointBId: b, name: null, locked: false, angleLocked: false, transparent: false, showDimensions: false, segmentType: "solid", doorSwingIn: true, doorHingeSide: "left" };
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  return { newSegment };
}

export function dbDuplicateObject(
  db: DatabaseSync,
  objectId: string,
  offsetX = 0.5,
  offsetY = 0.5
): { object: CanvasObject; points: CanvasPoint[]; segments: CanvasSegment[] } {
  const srcObj = db.prepare("SELECT * FROM objects WHERE id = ?").get(objectId) as DbRow;
  const srcPoints = db.prepare("SELECT * FROM points WHERE object_id = ? ORDER BY sort_order").all(objectId) as DbRow[];
  const srcSegments = db.prepare("SELECT * FROM segments WHERE object_id = ?").all(objectId) as DbRow[];

  const newObjId = nanoid();
  const pointIdMap = new Map<string, string>();

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO objects (id, project_id, layer_id, name, object_type_id, kind, line_color, fill_color, line_thickness, locked, owned, cost, url, notes, height_3d, custom_dims, rotation, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newObjId, v(srcObj.project_id), v(srcObj.layer_id),
      `${srcObj.name} (copy)`,
      v(srcObj.object_type_id), v(srcObj.kind), v(srcObj.line_color), v(srcObj.fill_color),
      v(srcObj.line_thickness), v(srcObj.locked), v(srcObj.owned), v(srcObj.cost),
      v(srcObj.url), v(srcObj.notes), v(srcObj.height_3d), v(srcObj.custom_dims), v(srcObj.rotation),
      (srcObj.sort_order as number) + 1
    );

    for (const p of srcPoints) {
      const newPid = nanoid();
      pointIdMap.set(p.id as string, newPid);
      db.prepare("INSERT INTO points (id, object_id, x, y, locked, snapping, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        newPid, newObjId, (p.x as number) + offsetX, (p.y as number) + offsetY, v(p.locked), v(p.snapping), v(p.sort_order)
      );
    }

    for (const s of srcSegments) {
      db.prepare("INSERT INTO segments (id, object_id, point_a_id, point_b_id, name, locked) VALUES (?, ?, ?, ?, ?, ?)").run(
        nanoid(), newObjId,
        pointIdMap.get(s.point_a_id as string) ?? null,
        pointIdMap.get(s.point_b_id as string) ?? null,
        v(s.name), v(s.locked)
      );
    }

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  const newObj = db.prepare("SELECT * FROM objects WHERE id = ?").get(newObjId) as DbRow;
  const newPoints = (db.prepare("SELECT * FROM points WHERE object_id = ? ORDER BY sort_order").all(newObjId) as DbRow[]).map(rowToPoint);
  const newSegments = (db.prepare("SELECT * FROM segments WHERE object_id = ?").all(newObjId) as DbRow[]).map(rowToSegment);

  return { object: rowToObject(newObj), points: newPoints, segments: newSegments };
}
