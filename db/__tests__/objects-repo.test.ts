import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import {
  dbCreateObject,
  dbLoadProjectData,
  dbUpdateObject,
  dbDeleteObject,
  dbUpdatePoint,
  dbUpdatePointFields,
  dbUpdateSegment,
  dbSplitSegment,
  dbDuplicateObject,
} from "../objects-repo";

const SCHEMA = fs.readFileSync(path.join(process.cwd(), "db/schema.sql"), "utf-8");

function makeDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  return db;
}

const PROJECT_ID = "proj-1";

function seedProject(db: DatabaseSync) {
  db.prepare(
    "INSERT INTO project (id, name, unit, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(PROJECT_ID, "Test Project", "feet", Date.now(), Date.now());
}

describe("dbCreateObject", () => {
  let db: DatabaseSync;
  beforeEach(() => { db = makeDb(); seedProject(db); });

  it("inserts an object and returns it", () => {
    const result = dbCreateObject(db, {
      projectId: PROJECT_ID,
      layerId: null,
      kind: "standard",
      name: "Sofa",
      points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }, { x: 0, y: 3 }],
    });

    expect(result.object.name).toBe("Sofa");
    expect(result.object.kind).toBe("standard");
    expect(result.object.projectId).toBe(PROJECT_ID);
    expect(result.points).toHaveLength(4);
    expect(result.segments).toHaveLength(4); // closed polygon
  });

  it("creates no segments for a round object", () => {
    const result = dbCreateObject(db, {
      projectId: PROJECT_ID,
      layerId: null,
      kind: "round",
      name: "Table",
      points: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
    });

    expect(result.segments).toHaveLength(0);
  });

  it("creates no segments when fewer than 2 points", () => {
    const result = dbCreateObject(db, {
      projectId: PROJECT_ID,
      layerId: null,
      kind: "standard",
      name: "Dot",
      points: [{ x: 0, y: 0 }],
    });

    expect(result.segments).toHaveLength(0);
  });

  it("stores point coordinates correctly", () => {
    const result = dbCreateObject(db, {
      projectId: PROJECT_ID,
      layerId: null,
      kind: "standard",
      name: "Box",
      points: [{ x: 1.5, y: 2.5 }, { x: 3.5, y: 2.5 }],
    });

    expect(result.points[0].x).toBe(1.5);
    expect(result.points[0].y).toBe(2.5);
    expect(result.points[1].x).toBe(3.5);
  });
});

describe("dbLoadProjectData", () => {
  let db: DatabaseSync;
  beforeEach(() => { db = makeDb(); seedProject(db); });

  it("returns empty arrays for a fresh project", () => {
    const data = dbLoadProjectData(db);
    expect(data.objects).toHaveLength(0);
    expect(data.points).toHaveLength(0);
    expect(data.segments).toHaveLength(0);
    expect(data.layers).toHaveLength(0);
  });

  it("returns created objects", () => {
    dbCreateObject(db, { projectId: PROJECT_ID, layerId: null, kind: "standard", name: "Chair", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] });
    const data = dbLoadProjectData(db);
    expect(data.objects).toHaveLength(1);
    expect(data.objects[0].name).toBe("Chair");
  });
});

describe("dbUpdateObject", () => {
  let db: DatabaseSync;
  let objectId: string;

  beforeEach(() => {
    db = makeDb();
    seedProject(db);
    const result = dbCreateObject(db, { projectId: PROJECT_ID, layerId: null, kind: "standard", name: "Old Name", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] });
    objectId = result.object.id;
  });

  it("updates the name", () => {
    dbUpdateObject(db, objectId, { name: "New Name" });
    const row = db.prepare("SELECT name FROM objects WHERE id = ?").get(objectId) as { name: string };
    expect(row.name).toBe("New Name");
  });

  it("updates locked state", () => {
    dbUpdateObject(db, objectId, { locked: true });
    const row = db.prepare("SELECT locked FROM objects WHERE id = ?").get(objectId) as { locked: number };
    expect(row.locked).toBe(1);
  });

  it("updates multiple fields at once", () => {
    dbUpdateObject(db, objectId, { name: "Updated", lineColor: "#ff0000", rotation: 45 });
    const row = db.prepare("SELECT name, line_color, rotation FROM objects WHERE id = ?").get(objectId) as { name: string; line_color: string; rotation: number };
    expect(row.name).toBe("Updated");
    expect(row.line_color).toBe("#ff0000");
    expect(row.rotation).toBe(45);
  });

  it("no-ops when no fields provided", () => {
    dbUpdateObject(db, objectId, {});
    const row = db.prepare("SELECT name FROM objects WHERE id = ?").get(objectId) as { name: string };
    expect(row.name).toBe("Old Name");
  });
});

describe("dbDeleteObject", () => {
  let db: DatabaseSync;
  let objectId: string;

  beforeEach(() => {
    db = makeDb();
    seedProject(db);
    const result = dbCreateObject(db, { projectId: PROJECT_ID, layerId: null, kind: "standard", name: "To Delete", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] });
    objectId = result.object.id;
  });

  it("removes the object", () => {
    dbDeleteObject(db, objectId);
    const row = db.prepare("SELECT id FROM objects WHERE id = ?").get(objectId);
    expect(row).toBeUndefined();
  });

  it("cascades to points and segments", () => {
    dbDeleteObject(db, objectId);
    const points = db.prepare("SELECT id FROM points WHERE object_id = ?").all(objectId);
    const segments = db.prepare("SELECT id FROM segments WHERE object_id = ?").all(objectId);
    expect(points).toHaveLength(0);
    expect(segments).toHaveLength(0);
  });
});

describe("dbUpdatePoint", () => {
  let db: DatabaseSync;
  let pointId: string;

  beforeEach(() => {
    db = makeDb();
    seedProject(db);
    const result = dbCreateObject(db, { projectId: PROJECT_ID, layerId: null, kind: "standard", name: "Obj", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] });
    pointId = result.points[0].id;
  });

  it("updates x and y coordinates", () => {
    dbUpdatePoint(db, pointId, 9.9, 8.8);
    const row = db.prepare("SELECT x, y FROM points WHERE id = ?").get(pointId) as { x: number; y: number };
    expect(row.x).toBeCloseTo(9.9);
    expect(row.y).toBeCloseTo(8.8);
  });
});

describe("dbUpdatePointFields", () => {
  let db: DatabaseSync;
  let pointId: string;

  beforeEach(() => {
    db = makeDb();
    seedProject(db);
    const result = dbCreateObject(db, { projectId: PROJECT_ID, layerId: null, kind: "standard", name: "Obj", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] });
    pointId = result.points[0].id;
  });

  it("sets locked", () => {
    dbUpdatePointFields(db, pointId, { locked: true });
    const row = db.prepare("SELECT locked FROM points WHERE id = ?").get(pointId) as { locked: number };
    expect(row.locked).toBe(1);
  });

  it("sets snapping to false", () => {
    dbUpdatePointFields(db, pointId, { snapping: false });
    const row = db.prepare("SELECT snapping FROM points WHERE id = ?").get(pointId) as { snapping: number };
    expect(row.snapping).toBe(0);
  });
});

describe("dbUpdateSegment", () => {
  let db: DatabaseSync;
  let segmentId: string;

  beforeEach(() => {
    db = makeDb();
    seedProject(db);
    const result = dbCreateObject(db, { projectId: PROJECT_ID, layerId: null, kind: "standard", name: "Obj", points: [{ x: 0, y: 0 }, { x: 4, y: 0 }] });
    segmentId = result.segments[0].id;
  });

  it("sets segment name", () => {
    dbUpdateSegment(db, segmentId, { name: "North Wall" });
    const row = db.prepare("SELECT name FROM segments WHERE id = ?").get(segmentId) as { name: string };
    expect(row.name).toBe("North Wall");
  });

  it("sets segment locked", () => {
    dbUpdateSegment(db, segmentId, { locked: true });
    const row = db.prepare("SELECT locked FROM segments WHERE id = ?").get(segmentId) as { locked: number };
    expect(row.locked).toBe(1);
  });
});

describe("dbSplitSegment", () => {
  let db: DatabaseSync;
  let segmentId: string;
  let ptAId: string;
  let ptBId: string;

  beforeEach(() => {
    db = makeDb();
    seedProject(db);
    const result = dbCreateObject(db, { projectId: PROJECT_ID, layerId: null, kind: "standard", name: "Obj", points: [{ x: 0, y: 0 }, { x: 4, y: 0 }] });
    segmentId = result.segments[0].id;
    ptAId = result.points[0].id;
    ptBId = result.points[1].id;
  });

  it("returns null for a non-existent segment", () => {
    expect(dbSplitSegment(db, "no-such-id")).toBeNull();
  });

  it("inserts a midpoint at the correct coordinates", () => {
    const split = dbSplitSegment(db, segmentId);
    expect(split).not.toBeNull();
    expect(split!.newPoint.x).toBe(2);
    expect(split!.newPoint.y).toBe(0);
  });

  it("removes the original segment", () => {
    dbSplitSegment(db, segmentId);
    const row = db.prepare("SELECT id FROM segments WHERE id = ?").get(segmentId);
    expect(row).toBeUndefined();
  });

  it("creates two replacement segments connecting through the midpoint", () => {
    const split = dbSplitSegment(db, segmentId)!;
    expect(split.segmentA.pointAId).toBe(ptAId);
    expect(split.segmentA.pointBId).toBe(split.newPoint.id);
    expect(split.segmentB.pointAId).toBe(split.newPoint.id);
    expect(split.segmentB.pointBId).toBe(ptBId);
  });
});

describe("dbDuplicateObject", () => {
  let db: DatabaseSync;
  let objectId: string;

  beforeEach(() => {
    db = makeDb();
    seedProject(db);
    const result = dbCreateObject(db, {
      projectId: PROJECT_ID,
      layerId: null,
      kind: "standard",
      name: "Original",
      points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }],
    });
    objectId = result.object.id;
  });

  it("creates a new object with ' (copy)' suffix", () => {
    const dup = dbDuplicateObject(db, objectId);
    expect(dup.object.name).toBe("Original (copy)");
    expect(dup.object.id).not.toBe(objectId);
  });

  it("offsets points by the given amount", () => {
    const dup = dbDuplicateObject(db, objectId, 1, 1);
    expect(dup.points[0].x).toBe(1);
    expect(dup.points[0].y).toBe(1);
  });

  it("copies the same number of points and segments", () => {
    const dup = dbDuplicateObject(db, objectId);
    expect(dup.points).toHaveLength(3);
    expect(dup.segments).toHaveLength(3);
  });

  it("duplicate segments reference the new points, not the originals", () => {
    const dup = dbDuplicateObject(db, objectId);
    const dupPointIds = new Set(dup.points.map((p) => p.id));
    for (const seg of dup.segments) {
      expect(dupPointIds.has(seg.pointAId)).toBe(true);
      expect(dupPointIds.has(seg.pointBId)).toBe(true);
    }
  });
});
