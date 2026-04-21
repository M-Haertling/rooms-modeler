import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";

enableMapSet();
import type {
  CanvasObject, CanvasPoint, CanvasSegment, CanvasLayer, ObjectType, Unit, Template,
} from "@/types/canvas";
import type { LassoRect } from "@/lib/lasso";

// ── Snapshot for undo/redo ───────────────────────────────────────────────────

interface CanvasSnapshot {
  objects: Record<string, CanvasObject>;
  points: Record<string, CanvasPoint>;
  segments: Record<string, CanvasSegment>;
  layers: Record<string, CanvasLayer>;
}

// ── Store shape ──────────────────────────────────────────────────────────────

interface StoreState {
  // Project
  modelId: string;
  projectId: string;
  projectName: string;
  unit: Unit;

  // Canvas data
  objects: Record<string, CanvasObject>;
  points: Record<string, CanvasPoint>;
  segments: Record<string, CanvasSegment>;
  layers: Record<string, CanvasLayer>;
  objectTypes: Record<string, ObjectType>;
  templates: Template[];

  // Selection
  selectedPointIds: Set<string>;
  selectedSegmentIds: Set<string>;
  selectedObjectIds: Set<string>;
  lassoRect: LassoRect | null;

  // UI
  sidePanelMode: "point" | "segment" | "object" | null;
  activeCatalog: "objects" | "templates" | "layers" | null;
  zoom: number;
  panOffset: { x: number; y: number };
  snapIndicatorPointId: string | null;

  // History
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
}

interface StoreActions {
  // Hydration
  hydrate(data: {
    modelId: string;
    projectId: string;
    projectName: string;
    unit: Unit;
    objects: CanvasObject[];
    points: CanvasPoint[];
    segments: CanvasSegment[];
    layers: CanvasLayer[];
    objectTypes: ObjectType[];
  }): void;

  setUnit(unit: Unit): void;
  setTemplates(templates: Template[]): void;

  // History
  pushHistory(): void;
  undo(): void;
  redo(): void;

  // Objects
  addObject(object: CanvasObject, points: CanvasPoint[], segments: CanvasSegment[]): void;
  updateObject(id: string, fields: Partial<CanvasObject>): void;
  removeObject(id: string): void;
  setObjectRotation(id: string, rotation: number, updatedPoints: CanvasPoint[]): void;

  // Points
  movePoint(id: string, x: number, y: number): void;
  updatePoint(id: string, fields: Partial<CanvasPoint>): void;
  removePoint(pointId: string, newSegment?: CanvasSegment): void;

  // Segments
  updateSegment(id: string, fields: Partial<CanvasSegment>): void;
  splitSegmentInStore(
    oldSegmentId: string,
    newPoint: CanvasPoint,
    segA: CanvasSegment,
    segB: CanvasSegment
  ): void;

  // Layers
  addLayer(layer: CanvasLayer): void;
  updateLayer(id: string, fields: Partial<CanvasLayer>): void;
  removeLayer(id: string): void;

  // Object types
  addObjectType(t: ObjectType): void;
  updateObjectType(id: string, name: string): void;
  removeObjectType(id: string): void;

  // Selection
  selectPoint(id: string, additive?: boolean): void;
  selectSegment(id: string | null, additive?: boolean): void;
  selectObject(id: string, additive?: boolean): void;
  addPointsToSelection(ids: string[]): void;
  addSegmentsToSelection(ids: string[]): void;
  clearSelection(): void;
  setLasso(rect: LassoRect | null): void;
  setSnapIndicator(pointId: string | null): void;

  // UI
  setSidePanelMode(mode: "point" | "segment" | "object" | null): void;
  setActiveCatalog(catalog: "objects" | "templates" | "layers" | null): void;
  setZoom(zoom: number): void;
  setPanOffset(offset: { x: number; y: number }): void;
}

type Store = StoreState & StoreActions;

function toRecord<T extends { id: string }>(arr: T[]): Record<string, T> {
  return Object.fromEntries(arr.map((x) => [x.id, x]));
}

function snapshot(state: StoreState): CanvasSnapshot {
  return {
    objects: { ...state.objects },
    points: { ...state.points },
    segments: { ...state.segments },
    layers: { ...state.layers },
  };
}

const MAX_HISTORY = 50;

export const useStore = create<Store>()(
  immer((set, get) => ({
    // Initial state
    modelId: "",
    projectId: "",
    projectName: "",
    unit: "standard",
    objects: {},
    points: {},
    segments: {},
    layers: {},
    objectTypes: {},
    templates: [],
    selectedPointIds: new Set(),
    selectedSegmentIds: new Set(),
    selectedObjectIds: new Set(),
    lassoRect: null,
    sidePanelMode: null,
    activeCatalog: null,
    zoom: 50,
    panOffset: { x: 0, y: 0 },
    snapIndicatorPointId: null,
    past: [],
    future: [],

    // ── Hydration ────────────────────────────────────────────────────────────
    hydrate(data) {
      set((s) => {
        s.modelId = data.modelId;
        s.projectId = data.projectId;
        s.projectName = data.projectName;
        const legacyMap: Record<string, Unit> = { feet: "standard", inches: "standard", cm: "metric", m: "metric", mm: "metric" };
        s.unit = legacyMap[data.unit as string] ?? (data.unit as Unit);
        s.objects = toRecord(data.objects);
        s.points = toRecord(data.points);
        s.segments = toRecord(data.segments);
        s.layers = toRecord(data.layers);
        s.objectTypes = toRecord(data.objectTypes);
        s.past = [];
        s.future = [];
      });
    },

    setUnit(unit) {
      set((s) => { s.unit = unit; });
    },

    setTemplates(templates) {
      set((s) => { s.templates = templates; });
    },

    // ── History ──────────────────────────────────────────────────────────────
    pushHistory() {
      set((s) => {
        const snap = snapshot(s as unknown as StoreState);
        s.past.push(snap);
        if (s.past.length > MAX_HISTORY) s.past.shift();
        s.future = [];
      });
    },

    undo() {
      const { past } = get();
      if (past.length === 0) return;
      set((s) => {
        const snap = snapshot(s as unknown as StoreState);
        s.future.unshift(snap);
        const prev = s.past.pop()!;
        Object.assign(s.objects, prev.objects);
        s.objects = prev.objects;
        s.points = prev.points;
        s.segments = prev.segments;
        s.layers = prev.layers;
        s.selectedPointIds = new Set();
        s.selectedSegmentIds = new Set();
        s.selectedObjectIds = new Set();
      });
    },

    redo() {
      const { future } = get();
      if (future.length === 0) return;
      set((s) => {
        const snap = snapshot(s as unknown as StoreState);
        s.past.push(snap);
        const next = s.future.shift()!;
        s.objects = next.objects;
        s.points = next.points;
        s.segments = next.segments;
        s.layers = next.layers;
        s.selectedPointIds = new Set();
        s.selectedSegmentIds = new Set();
        s.selectedObjectIds = new Set();
      });
    },

    // ── Objects ──────────────────────────────────────────────────────────────
    addObject(object, points, segments) {
      set((s) => {
        s.objects[object.id] = object;
        for (const p of points) s.points[p.id] = p;
        for (const seg of segments) s.segments[seg.id] = seg;
      });
    },

    updateObject(id, fields) {
      set((s) => {
        if (s.objects[id]) Object.assign(s.objects[id], fields);
      });
    },

    removeObject(id) {
      set((s) => {
        const pointIds = Object.values(s.points).filter((p) => p.objectId === id).map((p) => p.id);
        for (const pid of pointIds) delete s.points[pid];
        const segIds = Object.values(s.segments).filter((seg) => seg.objectId === id).map((seg) => seg.id);
        for (const sid of segIds) delete s.segments[sid];
        delete s.objects[id];
        s.selectedObjectIds.delete(id);
      });
    },

    setObjectRotation(id, rotation, updatedPoints) {
      set((s) => {
        if (s.objects[id]) s.objects[id].rotation = rotation;
        for (const p of updatedPoints) {
          if (s.points[p.id]) { s.points[p.id].x = p.x; s.points[p.id].y = p.y; }
        }
      });
    },

    // ── Points ───────────────────────────────────────────────────────────────
    movePoint(id, x, y) {
      set((s) => {
        if (s.points[id]) { s.points[id].x = x; s.points[id].y = y; }
      });
    },

    updatePoint(id, fields) {
      set((s) => {
        if (s.points[id]) Object.assign(s.points[id], fields);
      });
    },

    removePoint(pointId, newSegment) {
      set((s) => {
        for (const seg of Object.values(s.segments)) {
          if (seg.pointAId === pointId || seg.pointBId === pointId) delete s.segments[seg.id];
        }
        delete s.points[pointId];
        if (newSegment) s.segments[newSegment.id] = newSegment;
        s.selectedPointIds.delete(pointId);
        if (s.selectedPointIds.size === 0) s.sidePanelMode = null;
      });
    },

    // ── Segments ─────────────────────────────────────────────────────────────
    updateSegment(id, fields) {
      set((s) => {
        if (s.segments[id]) Object.assign(s.segments[id], fields);
      });
    },

    splitSegmentInStore(oldSegmentId, newPoint, segA, segB) {
      set((s) => {
        delete s.segments[oldSegmentId];
        s.points[newPoint.id] = newPoint;
        s.segments[segA.id] = segA;
        s.segments[segB.id] = segB;
      });
    },

    // ── Layers ───────────────────────────────────────────────────────────────
    addLayer(layer) {
      set((s) => { s.layers[layer.id] = layer; });
    },

    updateLayer(id, fields) {
      set((s) => {
        if (s.layers[id]) Object.assign(s.layers[id], fields);
      });
    },

    removeLayer(id) {
      set((s) => {
        delete s.layers[id];
        for (const obj of Object.values(s.objects)) {
          if (obj.layerId === id) obj.layerId = null;
        }
      });
    },

    // ── Object types ─────────────────────────────────────────────────────────
    addObjectType(t) {
      set((s) => { s.objectTypes[t.id] = t; });
    },

    updateObjectType(id, name) {
      set((s) => { if (s.objectTypes[id]) s.objectTypes[id].name = name; });
    },

    removeObjectType(id) {
      set((s) => {
        delete s.objectTypes[id];
        for (const obj of Object.values(s.objects)) {
          if (obj.objectTypeId === id) obj.objectTypeId = null;
        }
      });
    },

    // ── Selection ────────────────────────────────────────────────────────────
    selectPoint(id, additive = false) {
      set((s) => {
        if (!additive) { s.selectedPointIds = new Set(); s.selectedSegmentIds = new Set(); }
        s.selectedPointIds.add(id);
        const pt = s.points[id];
        if (pt) { s.selectedObjectIds = new Set([pt.objectId]); }
        s.sidePanelMode = "point";
      });
    },

    selectSegment(id, additive = false) {
      set((s) => {
        if (!additive) { s.selectedSegmentIds = new Set(); s.selectedPointIds = new Set(); }
        if (id) {
          s.selectedSegmentIds.add(id);
          const seg = s.segments[id];
          if (seg) s.selectedObjectIds = new Set([seg.objectId]);
          s.sidePanelMode = "segment";
        } else {
          s.selectedSegmentIds = new Set();
          s.sidePanelMode = null;
        }
      });
    },

    selectObject(id, additive = false) {
      set((s) => {
        if (!additive) { s.selectedObjectIds = new Set(); s.selectedPointIds = new Set(); s.selectedSegmentIds = new Set(); }
        s.selectedObjectIds.add(id);
        s.sidePanelMode = "object";
      });
    },

    addPointsToSelection(ids) {
      set((s) => {
        for (const id of ids) s.selectedPointIds.add(id);
        if (ids.length > 0) s.sidePanelMode = "point";
      });
    },

    addSegmentsToSelection(ids) {
      set((s) => {
        for (const id of ids) s.selectedSegmentIds.add(id);
        if (ids.length > 0) {
          const seg = s.segments[ids[0]];
          if (seg) s.selectedObjectIds = new Set([seg.objectId]);
          s.sidePanelMode = "segment";
        }
      });
    },

    clearSelection() {
      set((s) => {
        s.selectedPointIds = new Set();
        s.selectedSegmentIds = new Set();
        s.selectedObjectIds = new Set();
        s.sidePanelMode = null;
        s.lassoRect = null;
      });
    },

    setLasso(rect) {
      set((s) => { s.lassoRect = rect; });
    },

    setSnapIndicator(pointId) {
      set((s) => { s.snapIndicatorPointId = pointId; });
    },

    // ── UI ───────────────────────────────────────────────────────────────────
    setSidePanelMode(mode) {
      set((s) => { s.sidePanelMode = mode; });
    },

    setActiveCatalog(catalog) {
      set((s) => { s.activeCatalog = catalog; });
    },

    setZoom(zoom) {
      set((s) => { s.zoom = Math.max(10, Math.min(500, zoom)); });
    },

    setPanOffset(offset) {
      set((s) => { s.panOffset = offset; });
    },
  }))
);
