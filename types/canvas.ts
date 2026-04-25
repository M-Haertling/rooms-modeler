export type Unit = "standard" | "metric";

export interface Vec2 {
  x: number;
  y: number;
}

export interface CanvasPoint {
  id: string;
  objectId: string;
  x: number;
  y: number;
  xLocked: boolean;
  yLocked: boolean;
  angleLocked: boolean;
  snapping: boolean;
  sortOrder: number;
}

export interface CanvasSegment {
  id: string;
  objectId: string;
  pointAId: string;
  pointBId: string;
  name: string | null;
  locked: boolean;
  angleLocked: boolean;
  transparent: boolean;
  showDimensions: boolean;
  segmentType: "solid" | "door" | "window";
  doorSwingIn: boolean;
  doorHingeSide: "left" | "right";
}

export interface CustomDim {
  label: string;
  value: number;
}

export interface CanvasObject {
  id: string;
  projectId: string;
  layerId: string | null;
  name: string;
  objectTypeId: string | null;
  kind: "standard" | "round";
  lineColor: string;
  fillColor: string;
  lineThickness: number;
  locked: boolean;
  owned: boolean;
  cost: number | null;
  url: string | null;
  notes: string | null;
  height3d: number | null;
  customDims: CustomDim[];
  rotation: number;
  sortOrder: number;
  showDimensions: boolean;
  fillEnabled: boolean;
  fillOpacity: number;
  hidden: boolean;
  parentObjectId: string | null;
}

export interface CanvasLayer {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  hidden: boolean;
  sortOrder: number;
}

export interface ObjectType {
  id: string;
  projectId: string;
  name: string;
}

export interface ObjectImage {
  id: string;
  objectId: string;
  filePath: string;
  label: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface Template {
  id: string;
  projectId: string;
  name: string;
  kind: "standard" | "round";
  normalizedData: NormalizedTemplateData;
  thumbnailSvg: string | null;
  lineColor: string;
  fillColor: string;
  lineThickness: number;
  createdAt: number;
}

export interface NormalizedPoint {
  id: string;
  x: number;
  y: number;
  sortOrder: number;
}

export interface NormalizedSegment {
  id: string;
  pointAId: string;
  pointBId: string;
  name: string | null;
}

export interface NormalizedTemplateData {
  points: NormalizedPoint[];
  segments: NormalizedSegment[];
}

export interface Project {
  id: string;
  name: string;
  unit: Unit;
  createdAt: number;
  updatedAt: number;
}

export interface ModelFile {
  id: string;
  name: string;
  path: string;
  updatedAt: number;
}
