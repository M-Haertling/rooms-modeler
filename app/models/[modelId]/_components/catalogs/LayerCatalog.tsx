"use client";

import { useState, useMemo, useRef } from "react";
import { useStore } from "@/store";
import { createLayer, updateLayer, deleteLayer } from "@/actions/layers";
import { updateObject } from "@/actions/objects";
import CatalogHeader from "./CatalogHeader";
import type { CanvasLayer, CanvasObject } from "@/types/canvas";

// --- Icons ---

function EyeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// --- Drag state types ---

interface LayerDragState {
  draggedId: string | null;
  dragOverId: string | null;
  dragOverPosition: "before" | "after";
  onDragStart: (id: string) => void;
  onDragOver: (id: string, position: "before" | "after") => void;
  onDrop: (targetId: string, position: "before" | "after", siblings: CanvasLayer[]) => void;
  onDragEnd: () => void;
}

interface ObjectDragState {
  draggedId: string | null;
  dragOverId: string | null;
  dragOverType: "object" | "layer" | null;
  dragOverPosition: "before" | "after" | "child";
  onDragStart: (id: string) => void;
  onDragOver: (id: string, type: "object" | "layer", position: "before" | "after" | "child") => void;
  onDrop: (targetId: string, targetType: "object" | "layer", position: "before" | "after" | "child") => void;
  onDragEnd: () => void;
}

// --- Main catalog ---

export default function LayerCatalog() {
  const [search, setSearch] = useState("");

  // Layer drag state
  const [layerDraggedId, setLayerDraggedId] = useState<string | null>(null);
  const [layerDragOverId, setLayerDragOverId] = useState<string | null>(null);
  const [layerDragOverPosition, setLayerDragOverPosition] = useState<"before" | "after">("after");

  // Object drag state
  const [objDraggedId, setObjDraggedId] = useState<string | null>(null);
  const [objDragOverId, setObjDragOverId] = useState<string | null>(null);
  const [objDragOverType, setObjDragOverType] = useState<"object" | "layer" | null>(null);
  const [objDragOverPosition, setObjDragOverPosition] = useState<"before" | "after" | "child">("after");

  const layers = useStore((s) => s.layers);
  const objects = useStore((s) => s.objects);
  const modelId = useStore((s) => s.modelId);
  const projectId = useStore((s) => s.projectId);
  const storeAddLayer = useStore((s) => s.addLayer);
  const storeUpdateLayer = useStore((s) => s.updateLayer);
  const storeRemoveLayer = useStore((s) => s.removeLayer);
  const storeUpdateObject = useStore((s) => s.updateObject);
  const selectObject = useStore((s) => s.selectObject);

  // Descending sort: top of list = highest sortOrder = in front (Photoshop convention)
  const allRootLayers = useMemo(
    () =>
      Object.values(layers)
        .filter((l) => !l.parentId)
        .sort((a, b) => b.sortOrder - a.sortOrder),
    [layers]
  );

  const rootLayers = useMemo(
    () => allRootLayers.filter((l) => l.name.toLowerCase().includes(search.toLowerCase())),
    [allRootLayers, search]
  );

  const unassignedObjects = useMemo(
    () =>
      Object.values(objects)
        .filter((o) => !o.layerId && !o.parentObjectId)
        .sort((a, b) => b.sortOrder - a.sortOrder || a.name.localeCompare(b.name)),
    [objects]
  );

  async function handleCreate() {
    const layer = await createLayer(modelId, projectId, "New layer");
    storeAddLayer(layer);
  }

  function handleLayerDrop(targetId: string, position: "before" | "after", siblings: CanvasLayer[]) {
    if (!layerDraggedId || layerDraggedId === targetId) return;
    // siblings are in descending order in the UI; for fractional sort we work with ascending values
    const ascSiblings = [...siblings].sort((a, b) => a.sortOrder - b.sortOrder);
    const withoutDragged = ascSiblings.filter((l) => l.id !== layerDraggedId);
    const targetIndex = withoutDragged.findIndex((l) => l.id === targetId);
    if (targetIndex === -1) return;

    let newSortOrder: number;
    // In ascending array: "before" in descending UI = insert after in ascending
    if (position === "before") {
      const next = withoutDragged[targetIndex + 1];
      newSortOrder = next
        ? (withoutDragged[targetIndex].sortOrder + next.sortOrder) / 2
        : withoutDragged[targetIndex].sortOrder + 1;
    } else {
      const prev = withoutDragged[targetIndex - 1];
      newSortOrder = prev
        ? (prev.sortOrder + withoutDragged[targetIndex].sortOrder) / 2
        : withoutDragged[targetIndex].sortOrder - 1;
    }

    storeUpdateLayer(layerDraggedId, { sortOrder: newSortOrder });
    updateLayer(modelId, layerDraggedId, { sortOrder: newSortOrder });
  }

  function handleObjectDrop(targetId: string, targetType: "object" | "layer", position: "before" | "after" | "child") {
    if (!objDraggedId) return;
    const dragged = objects[objDraggedId];
    if (!dragged) return;

    if (targetType === "layer") {
      // Drop onto a layer header — append to top of layer (highest sortOrder)
      const layerSiblings = Object.values(objects)
        .filter((o) => o.layerId === targetId && !o.parentObjectId && o.id !== objDraggedId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const maxOrder = layerSiblings.length > 0 ? layerSiblings[layerSiblings.length - 1].sortOrder + 1000 : 1000;
      storeUpdateObject(objDraggedId, { layerId: targetId, parentObjectId: null, sortOrder: maxOrder });
      updateObject(modelId, objDraggedId, { layerId: targetId, parentObjectId: null, sortOrder: maxOrder });
      return;
    }

    // Drop onto an object
    const target = objects[targetId];
    if (!target || targetId === objDraggedId) return;

    if (position === "child") {
      // Make dragged a child of target
      const targetChildren = Object.values(objects)
        .filter((o) => o.parentObjectId === targetId && o.id !== objDraggedId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const maxOrder = targetChildren.length > 0 ? targetChildren[targetChildren.length - 1].sortOrder + 1000 : 1000;
      storeUpdateObject(objDraggedId, { parentObjectId: targetId, layerId: target.layerId, sortOrder: maxOrder });
      updateObject(modelId, objDraggedId, { parentObjectId: targetId, layerId: target.layerId, sortOrder: maxOrder });
      return;
    }

    // before/after: sibling of target (shares same parentObjectId and layerId)
    const siblings = Object.values(objects)
      .filter((o) => o.layerId === target.layerId && o.parentObjectId === target.parentObjectId && o.id !== objDraggedId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // UI is descending; "before" in UI = higher sortOrder = insert after in ascending array
    const targetIndex = siblings.findIndex((o) => o.id === targetId);
    if (targetIndex === -1) return;

    let newSortOrder: number;
    if (position === "before") {
      // insert above target in UI = higher sortOrder
      const next = siblings[targetIndex + 1];
      newSortOrder = next
        ? (siblings[targetIndex].sortOrder + next.sortOrder) / 2
        : siblings[targetIndex].sortOrder + 1000;
    } else {
      // insert below target in UI = lower sortOrder
      const prev = siblings[targetIndex - 1];
      newSortOrder = prev
        ? (prev.sortOrder + siblings[targetIndex].sortOrder) / 2
        : siblings[targetIndex].sortOrder - 1000;
      if (newSortOrder < 0) newSortOrder = 0;
    }

    storeUpdateObject(objDraggedId, { layerId: target.layerId, parentObjectId: target.parentObjectId, sortOrder: newSortOrder });
    updateObject(modelId, objDraggedId, { layerId: target.layerId, parentObjectId: target.parentObjectId, sortOrder: newSortOrder });
  }

  const layerDragState: LayerDragState = {
    draggedId: layerDraggedId,
    dragOverId: layerDragOverId,
    dragOverPosition: layerDragOverPosition,
    onDragStart: setLayerDraggedId,
    onDragOver: (id, pos) => { setLayerDragOverId(id); setLayerDragOverPosition(pos); },
    onDrop: handleLayerDrop,
    onDragEnd: () => { setLayerDraggedId(null); setLayerDragOverId(null); },
  };

  const objectDragState: ObjectDragState = {
    draggedId: objDraggedId,
    dragOverId: objDragOverId,
    dragOverType: objDragOverType,
    dragOverPosition: objDragOverPosition,
    onDragStart: setObjDraggedId,
    onDragOver: (id, type, pos) => { setObjDragOverId(id); setObjDragOverType(type); setObjDragOverPosition(pos); },
    onDrop: handleObjectDrop,
    onDragEnd: () => { setObjDraggedId(null); setObjDragOverId(null); setObjDragOverType(null); },
  };

  return (
    <div className="flex flex-col h-full">
      <CatalogHeader title="Layers" search={search} onSearch={setSearch} />
      <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <button onClick={handleCreate} className="text-xs" style={{ color: "var(--accent)" }}>
          + New layer
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rootLayers.map((layer) => (
          <LayerRow
            key={layer.id}
            layerId={layer.id}
            depth={0}
            modelId={modelId}
            projectId={projectId}
            storeUpdateLayer={storeUpdateLayer}
            storeRemoveLayer={storeRemoveLayer}
            storeAddLayer={storeAddLayer}
            storeUpdateObject={storeUpdateObject}
            selectObject={selectObject}
            allLayers={layers}
            allObjects={objects}
            siblings={allRootLayers}
            layerDragState={layerDragState}
            objectDragState={objectDragState}
            ancestorHidden={false}
          />
        ))}
        {unassignedObjects.length > 0 && (
          <div>
            <div
              className="px-4 py-2 border-b text-xs font-medium"
              style={{ color: "var(--text-muted)", borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              Unassigned
            </div>
            {unassignedObjects.map((obj) => (
              <ObjectRow
                key={obj.id}
                object={obj}
                depth={0}
                modelId={modelId}
                selectObject={selectObject}
                dimmed={false}
                objectDragState={objectDragState}
                storeUpdateObject={storeUpdateObject}
                allObjects={objects}
              />
            ))}
          </div>
        )}
        {rootLayers.length === 0 && unassignedObjects.length === 0 && (
          <p className="text-xs p-4" style={{ color: "var(--text-muted)" }}>No layers yet.</p>
        )}
      </div>
    </div>
  );
}

// --- Object row ---

function ObjectRow({
  object, depth = 0, modelId, selectObject, dimmed, objectDragState, storeUpdateObject, allObjects,
}: {
  object: CanvasObject;
  depth?: number;
  modelId: string;
  selectObject: (id: string, additive?: boolean) => void;
  dimmed: boolean;
  objectDragState: ObjectDragState;
  storeUpdateObject: (id: string, fields: Partial<CanvasObject>) => void;
  allObjects: Record<string, CanvasObject>;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const children = useMemo(
    () => Object.values(allObjects)
      .filter((o) => o.parentObjectId === object.id)
      .sort((a, b) => b.sortOrder - a.sortOrder || a.name.localeCompare(b.name)),
    [allObjects, object.id]
  );

  const isDragging = objectDragState.draggedId === object.id;
  const isOver = objectDragState.dragOverId === object.id && objectDragState.dragOverType === "object";
  const isChildTarget = isOver && objectDragState.dragOverPosition === "child";

  function startEditing() {
    setEditName(object.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commitRename() {
    const trimmed = editName.trim();
    setEditing(false);
    if (!trimmed || trimmed === object.name) return;
    storeUpdateObject(object.id, { name: trimmed });
    await updateObject(modelId, object.id, { name: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setEditing(false);
  }

  async function toggleHidden() {
    storeUpdateObject(object.id, { hidden: !object.hidden });
    await updateObject(modelId, object.id, { hidden: !object.hidden });
  }

  function handleDragStart(e: React.DragEvent) {
    if (editing) { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = "move";
    objectDragState.onDragStart(object.id);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!objectDragState.draggedId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const third = rect.height / 3;
    let position: "before" | "after" | "child";
    if (relY < third) position = "before";
    else if (relY > rect.height - third) position = "after";
    else position = "child";
    objectDragState.onDragOver(object.id, "object", position);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!objectDragState.draggedId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const third = rect.height / 3;
    let position: "before" | "after" | "child";
    if (relY < third) position = "before";
    else if (relY > rect.height - third) position = "after";
    else position = "child";
    objectDragState.onDrop(object.id, "object", position);
    objectDragState.onDragEnd();
  }

  return (
    <div>
      <div
        draggable={!editing}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={objectDragState.onDragEnd}
        className="flex items-center gap-2 border-b"
        style={{
          paddingLeft: `${20 + depth * 12}px`,
          paddingRight: "12px",
          paddingTop: "6px",
          paddingBottom: "6px",
          borderColor: "var(--border)",
          opacity: dimmed || object.hidden || isDragging ? 0.4 : 1,
          cursor: editing ? "default" : "grab",
          background: isChildTarget ? "color-mix(in srgb, var(--accent) 15%, transparent)" : undefined,
          outline: isChildTarget ? "1px solid var(--accent)" : undefined,
          outlineOffset: "-1px",
          borderTop: isOver && objectDragState.dragOverPosition === "before" ? "2px solid var(--accent)" : undefined,
          borderBottom: isOver && objectDragState.dragOverPosition === "after"
            ? "2px solid var(--accent)"
            : "1px solid var(--border)",
        }}
        onClick={(e) => { if (!editing) selectObject(object.id, e.shiftKey); }}
      >
        {/* Collapse toggle — only when has children */}
        {children.length > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
            className="shrink-0 flex items-center justify-center w-4"
            style={{
              color: "var(--text-muted)",
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 150ms",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M5 7 L1 3 L9 3 Z" />
            </svg>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Visibility toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleHidden(); }}
          className="shrink-0 flex items-center justify-center w-5"
          style={{ color: object.hidden ? "var(--text-muted)" : "var(--text)" }}
          title={object.hidden ? "Show object" : "Hide object"}
        >
          {object.hidden ? <EyeOffIcon /> : <EyeIcon />}
        </button>

        <span
          className="w-3 h-3 rounded-full shrink-0 border"
          style={{ background: object.fillColor, borderColor: object.lineColor }}
        />
        {editing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="text-xs flex-1 min-w-0 rounded px-1 outline-none"
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--accent)" }}
          />
        ) : (
          <span
            className="text-xs flex-1 truncate"
            style={{ color: "var(--text)" }}
            onDoubleClick={(e) => { e.stopPropagation(); startEditing(); }}
            title="Double-click to rename"
          >{object.name}</span>
        )}
      </div>

      {/* Recursive children */}
      {!collapsed && children.map((child) => (
        <ObjectRow
          key={child.id}
          object={child}
          depth={depth + 1}
          modelId={modelId}
          selectObject={selectObject}
          dimmed={dimmed || object.hidden}
          objectDragState={objectDragState}
          storeUpdateObject={storeUpdateObject}
          allObjects={allObjects}
        />
      ))}
    </div>
  );
}

// --- Layer row ---

function LayerRow({
  layerId, depth, modelId, projectId,
  storeUpdateLayer, storeRemoveLayer, storeAddLayer, storeUpdateObject, selectObject,
  allLayers, allObjects, siblings, layerDragState, objectDragState, ancestorHidden,
}: {
  layerId: string;
  depth: number;
  modelId: string;
  projectId: string;
  storeUpdateLayer: (id: string, fields: Partial<CanvasLayer>) => void;
  storeRemoveLayer: (id: string) => void;
  storeAddLayer: (l: CanvasLayer) => void;
  storeUpdateObject: (id: string, fields: Partial<CanvasObject>) => void;
  selectObject: (id: string, additive?: boolean) => void;
  allLayers: Record<string, CanvasLayer>;
  allObjects: Record<string, CanvasObject>;
  siblings: CanvasLayer[];
  layerDragState: LayerDragState;
  objectDragState: ObjectDragState;
  ancestorHidden: boolean;
}) {
  const layer = allLayers[layerId];
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!layer) return null;

  // Descending sort: top = in front
  const children = Object.values(allLayers)
    .filter((l) => l.parentId === layerId)
    .sort((a, b) => b.sortOrder - a.sortOrder);

  const layerObjects = Object.values(allObjects)
    .filter((o) => o.layerId === layerId && !o.parentObjectId)
    .sort((a, b) => b.sortOrder - a.sortOrder || a.name.localeCompare(b.name));

  const isLayerOver = layerDragState.dragOverId === layerId;
  const isObjDragTarget = objectDragState.dragOverId === layerId && objectDragState.dragOverType === "layer";
  const isDragging = layerDragState.draggedId === layerId;
  const effectivelyHidden = ancestorHidden || layer.hidden;

  // siblings are descending in UI; find the layer that is "above" in the list (next item in descending = lower sortOrder = visually below)
  const myIndex = siblings.findIndex((l) => l.id === layerId);
  // The layer directly below us in the UI list (lower sortOrder, higher index in descending array) = the one to indent into
  const layerBelow = myIndex < siblings.length - 1 ? siblings[myIndex + 1] : null;

  const parentLayer = layer.parentId ? allLayers[layer.parentId] : null;
  const grandparentId = parentLayer?.parentId ?? null;
  const parentSiblings = Object.values(allLayers)
    .filter((l) => l.parentId === grandparentId)
    .sort((a, b) => b.sortOrder - a.sortOrder);

  async function toggleHidden() {
    storeUpdateLayer(layerId, { hidden: !layer.hidden });
    await updateLayer(modelId, layerId, { hidden: !layer.hidden });
  }

  async function handleDelete() {
    storeRemoveLayer(layerId);
    await deleteLayer(modelId, layerId);
  }

  async function handleAddChild() {
    const child = await createLayer(modelId, projectId, "Sub-layer", layerId);
    storeAddLayer(child);
  }

  function startEditing() {
    setEditName(layer.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commitRename() {
    const trimmed = editName.trim();
    setEditing(false);
    if (!trimmed || trimmed === layer.name) return;
    storeUpdateLayer(layerId, { name: trimmed });
    await updateLayer(modelId, layerId, { name: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setEditing(false);
  }

  async function handleIndent() {
    if (!layerBelow) return;
    // Make this layer a child of the layer below it in the UI (layerBelow has lower sortOrder)
    const belowChildren = Object.values(allLayers)
      .filter((l) => l.parentId === layerBelow.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    // In rendering, higher sortOrder = in front. New child should go to top (in front) of existing children.
    const newSortOrder = belowChildren.length > 0 ? belowChildren[belowChildren.length - 1].sortOrder + 1 : 1;
    storeUpdateLayer(layerId, { parentId: layerBelow.id, sortOrder: newSortOrder });
    await updateLayer(modelId, layerId, { parentId: layerBelow.id, sortOrder: newSortOrder });
  }

  async function handleOutdent() {
    if (!parentLayer) return;
    const parentIndex = parentSiblings.findIndex((l) => l.id === parentLayer.id);
    // Place this layer just below the parent in descending UI = lower sortOrder than parent
    const next = parentSiblings[parentIndex + 1]; // next in descending array = lower sortOrder
    const newSortOrder = next
      ? (parentLayer.sortOrder + next.sortOrder) / 2
      : parentLayer.sortOrder - 1;
    storeUpdateLayer(layerId, { parentId: grandparentId, sortOrder: newSortOrder });
    await updateLayer(modelId, layerId, { parentId: grandparentId, sortOrder: newSortOrder });
  }

  function handleDragStart(e: React.DragEvent) {
    if (editing) { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = "move";
    layerDragState.onDragStart(layerId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (objectDragState.draggedId) {
      objectDragState.onDragOver(layerId, "layer", "child");
    } else if (layerDragState.draggedId) {
      e.dataTransfer.dropEffect = "move";
      const rect = e.currentTarget.getBoundingClientRect();
      const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
      layerDragState.onDragOver(layerId, position);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (objectDragState.draggedId) {
      objectDragState.onDrop(layerId, "layer", "child");
      objectDragState.onDragEnd();
    } else if (layerDragState.draggedId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
      layerDragState.onDrop(layerId, position, siblings);
      layerDragState.onDragEnd();
    }
  }

  const sharedChildProps = {
    modelId,
    projectId,
    storeUpdateLayer,
    storeRemoveLayer,
    storeAddLayer,
    storeUpdateObject,
    selectObject,
    allLayers,
    allObjects,
    layerDragState,
    objectDragState,
    ancestorHidden: effectivelyHidden,
  };

  return (
    <div>
      <div
        draggable={!editing}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={layerDragState.onDragEnd}
        className="flex items-center gap-1 px-4 py-3 border-b"
        style={{
          paddingLeft: `${16 + depth * 12}px`,
          borderColor: "var(--border)",
          opacity: isDragging ? 0.4 : effectivelyHidden ? 0.45 : 1,
          cursor: editing ? "default" : "grab",
          background: isObjDragTarget ? "color-mix(in srgb, var(--accent) 15%, transparent)" : undefined,
          borderTop:
            isLayerOver && layerDragState.dragOverPosition === "before"
              ? "2px solid var(--accent)"
              : undefined,
          borderBottom:
            isLayerOver && layerDragState.dragOverPosition === "after"
              ? "2px solid var(--accent)"
              : `1px solid var(--border)`,
          outline: isObjDragTarget ? "1px solid var(--accent)" : undefined,
          outlineOffset: "-1px",
        }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 flex items-center justify-center w-4"
          style={{
            color: "var(--text-muted)",
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 150ms",
          }}
          title={collapsed ? "Expand layer" : "Collapse layer"}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 7 L1 3 L9 3 Z" />
          </svg>
        </button>
        <button
          onClick={toggleHidden}
          className="shrink-0 flex items-center justify-center w-5"
          style={{ color: layer.hidden ? "var(--text-muted)" : "var(--text)" }}
          title={layer.hidden ? "Show layer" : "Hide layer"}
        >
          {layer.hidden ? <EyeOffIcon /> : <EyeIcon />}
        </button>

        {editing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            className="text-sm flex-1 min-w-0 bg-transparent outline outline-1 rounded px-1"
            style={{ outlineColor: "var(--accent)", color: "var(--text)" }}
          />
        ) : (
          <span
            className="text-sm flex-1 truncate"
            style={{ color: "var(--text)", cursor: "text" }}
            onDoubleClick={startEditing}
            title="Double-click to rename"
          >
            {layer.name}
          </span>
        )}

        {parentLayer && !editing && (
          <button
            onClick={handleOutdent}
            className="text-sm px-1.5 py-0.5 rounded opacity-60 hover:opacity-100"
            style={{ color: "var(--text-muted)" }}
            title={`Promote out of "${parentLayer.name}"`}
          >
            ⇤
          </button>
        )}
        {layerBelow && !editing && (
          <button
            onClick={handleIndent}
            className="text-sm px-1.5 py-0.5 rounded opacity-60 hover:opacity-100"
            style={{ color: "var(--text-muted)" }}
            title={`Make sub-layer of "${layerBelow.name}"`}
          >
            ⇥
          </button>
        )}
        <button
          onClick={handleAddChild}
          className="text-base px-1.5 py-0.5 rounded opacity-60 hover:opacity-100 leading-none"
          style={{ color: "var(--accent)" }}
          title="Add sub-layer"
        >
          +
        </button>
        <button
          onClick={handleDelete}
          className="text-base px-1.5 py-0.5 rounded opacity-60 hover:opacity-100 leading-none"
          style={{ color: "var(--danger)" }}
        >
          ×
        </button>
      </div>

      {!collapsed && layerObjects.map((obj) => (
        <ObjectRow
          key={obj.id}
          object={obj}
          depth={depth + 1}
          modelId={modelId}
          selectObject={selectObject}
          dimmed={effectivelyHidden}
          objectDragState={objectDragState}
          storeUpdateObject={storeUpdateObject}
          allObjects={allObjects}
        />
      ))}

      {!collapsed && children.map((child) => (
        <LayerRow
          key={child.id}
          layerId={child.id}
          depth={depth + 1}
          siblings={children}
          {...sharedChildProps}
        />
      ))}
    </div>
  );
}
