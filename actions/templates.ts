"use server";

import { nanoid } from "nanoid";
import { getDb, resolveModelPath } from "@/db/client";
import type { Template, CanvasObject, CanvasPoint, CanvasSegment } from "@/types/canvas";
import { normalizeObject, instantiateTemplate } from "@/lib/normalize";

type DbRow = Record<string, unknown>;
type SQLVal = null | bigint | number | string | Uint8Array;
function v(x: unknown): SQLVal { return x as SQLVal; }

function rowToTemplate(r: DbRow): Template {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    name: r.name as string,
    kind: r.kind as "standard" | "round",
    normalizedData: JSON.parse(r.normalized_data as string),
    thumbnailSvg: (r.thumbnail_svg as string | null) ?? null,
    lineColor: r.line_color as string,
    fillColor: r.fill_color as string,
    lineThickness: r.line_thickness as number,
    createdAt: r.created_at as number,
  };
}

export async function saveTemplate(
  modelId: string,
  objectId: string,
  name: string
): Promise<Template> {
  const db = getDb(resolveModelPath(modelId));
  const obj = db.prepare("SELECT * FROM objects WHERE id = ?").get(objectId) as DbRow;
  const rawPoints = db.prepare("SELECT * FROM points WHERE object_id = ? ORDER BY sort_order").all(objectId) as DbRow[];
  const rawSegments = db.prepare("SELECT * FROM segments WHERE object_id = ?").all(objectId) as DbRow[];

  const points: CanvasPoint[] = rawPoints.map((r) => ({
    id: r.id as string, objectId: r.object_id as string,
    x: r.x as number, y: r.y as number,
    locked: Boolean(r.locked), snapping: Boolean(r.snapping),
    sortOrder: r.sort_order as number,
  }));
  const segments: CanvasSegment[] = rawSegments.map((r) => ({
    id: r.id as string, objectId: r.object_id as string,
    pointAId: r.point_a_id as string, pointBId: r.point_b_id as string,
    name: (r.name as string | null) ?? null, locked: Boolean(r.locked),
  }));

  const normalizedData = normalizeObject(points, segments);

  const projectRow = db.prepare("SELECT id FROM project LIMIT 1").get() as DbRow;
  const templateId = nanoid();
  db.prepare(
    `INSERT INTO templates (id, project_id, name, kind, normalized_data, line_color, fill_color, line_thickness, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    templateId, v(projectRow.id), name, v(obj.kind),
    JSON.stringify(normalizedData),
    v(obj.line_color), v(obj.fill_color), v(obj.line_thickness), Date.now()
  );

  return rowToTemplate(db.prepare("SELECT * FROM templates WHERE id = ?").get(templateId) as DbRow);
}

export async function listTemplates(modelId: string): Promise<Template[]> {
  const db = getDb(resolveModelPath(modelId));
  return (db.prepare("SELECT * FROM templates ORDER BY created_at DESC").all() as DbRow[]).map(rowToTemplate);
}

export async function instantiateFromTemplate(
  modelId: string,
  templateId: string,
  params: { name: string; width: number; height: number; originX: number; originY: number; layerId: string | null }
): Promise<{ object: CanvasObject; points: CanvasPoint[]; segments: CanvasSegment[] }> {
  const db = getDb(resolveModelPath(modelId));
  const tmpl = db.prepare("SELECT * FROM templates WHERE id = ?").get(templateId) as DbRow;
  const projectRow = db.prepare("SELECT id FROM project LIMIT 1").get() as DbRow;

  const normalizedData = JSON.parse(tmpl.normalized_data as string);
  const { points: instPoints, segments: instSegments } = instantiateTemplate(
    normalizedData, params.width, params.height, params.originX, params.originY
  );

  const objId = nanoid();
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO objects (id, project_id, layer_id, name, kind, line_color, fill_color, line_thickness, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(objId, v(projectRow.id), params.layerId, params.name, v(tmpl.kind), v(tmpl.line_color), v(tmpl.fill_color), v(tmpl.line_thickness), Date.now());

    const pointIdMap = new Map<string, string>();
    const createdPoints: CanvasPoint[] = [];
    for (const p of instPoints) {
      const pid = nanoid();
      pointIdMap.set(p.id, pid);
      db.prepare("INSERT INTO points (id, object_id, x, y, sort_order) VALUES (?, ?, ?, ?, ?)").run(pid, objId, p.x, p.y, p.sortOrder);
      createdPoints.push({ id: pid, objectId: objId, x: p.x, y: p.y, locked: false, snapping: true, sortOrder: p.sortOrder });
    }

    const createdSegments: CanvasSegment[] = [];
    for (const s of instSegments) {
      const sid = nanoid();
      const aId = pointIdMap.get(s.pointAId)!;
      const bId = pointIdMap.get(s.pointBId)!;
      db.prepare("INSERT INTO segments (id, object_id, point_a_id, point_b_id, name) VALUES (?, ?, ?, ?, ?)").run(sid, objId, aId, bId, s.name);
      createdSegments.push({ id: sid, objectId: objId, pointAId: aId, pointBId: bId, name: s.name, locked: false });
    }

    db.exec("COMMIT");

    const objRow = db.prepare("SELECT * FROM objects WHERE id = ?").get(objId) as DbRow;
    return {
      object: {
        id: objId, projectId: projectRow.id as string, layerId: params.layerId,
        name: params.name, objectTypeId: null,
        kind: tmpl.kind as "standard" | "round",
        lineColor: tmpl.line_color as string, fillColor: tmpl.fill_color as string,
        lineThickness: tmpl.line_thickness as number,
        locked: false, owned: false, cost: null, url: null, notes: null,
        height3d: null, customDims: [], rotation: 0, sortOrder: objRow.sort_order as number,
      },
      points: createdPoints,
      segments: createdSegments,
    };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export async function deleteTemplate(modelId: string, templateId: string): Promise<void> {
  const db = getDb(resolveModelPath(modelId));
  db.prepare("DELETE FROM templates WHERE id = ?").run(templateId);
}
