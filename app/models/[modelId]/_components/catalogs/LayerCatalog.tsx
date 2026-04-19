"use client";

import { useState, useMemo, useRef } from "react";
import { useStore } from "@/store";
import { createLayer, updateLayer, deleteLayer, moveObjectToLayer } from "@/actions/layers";
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

// --- Drag state ---

interface DragState {
  draggedId: string | null;
  dragOverId: string | null;
  dragOverPosition: "before" | "after";
  onDragStart: (id: string) => void;
  onDragOver: (id: string, position: "before" | "after") => void;
  onDrop: (targetId: string, position: "before" | "after", siblings: CanvasLayer[]) => void;
  onDragEnd: () => void;
}

// --- Main catalog ---

export default function LayerCatalog() {
  const [search, setSearch] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after">("after");

  const layers = useStore((s) => s.layers);
  const objects = useStore((s) => s.objects);
  const modelId = useStore((s) => s.modelId);
  const projectId = useStore((s) => s.projectId);
  const storeAddLayer = useStore((s) => s.addLayer);
  const storeUpdateLayer = useStore((s) => s.updateLayer);
  const storeRemoveLayer = useStore((s) => s.removeLayer);
  const storeUpdateObject = useStore((s) => s.updateObject);
  const selectObject = useStore((s) => s.selectObject);

  const allRootLayers = useMemo(
    () =>
      Object.values(layers)
        .filter((l) => !l.parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [layers]
  );

  const rootLayers = useMemo(
    () => allRootLayers.filter((l) => l.name.toLowerCase().includes(search.toLowerCase())),
    [allRootLayers, search]
  );

  const allLayersList = useMemo(() => Object.values(layers), [layers]);

  const unassignedObjects = useMemo(
    () => Object.values(objects).filter((o) => !o.layerId).sort((a, b) => a.name.localeCompare(b.name)),
    [objects]
  );

  async function handleCreate() {
    const layer = await createLayer(modelId, projectId, "New layer");
    storeAddLayer(layer);
  }

  function handleDrop(targetId: string, position: "before" | "after", siblings: CanvasLayer[]) {
    if (!draggedId || draggedId === targetId) return;
    const withoutDragged = siblings.filter((l) => l.id !== draggedId);
    const targetIndex = withoutDragged.findIndex((l) => l.id === targetId);
    if (targetIndex === -1) return;

    let newSortOrder: number;
    if (position === "before") {
      const prev = withoutDragged[targetIndex - 1];
      newSortOrder = prev
        ? (prev.sortOrder + withoutDragged[targetIndex].sortOrder) / 2
        : withoutDragged[targetIndex].sortOrder - 1;
    } else {
      const next = withoutDragged[targetIndex + 1];
      newSortOrder = next
        ? (withoutDragged[targetIndex].sortOrder + next.sortOrder) / 2
        : withoutDragged[targetIndex].sortOrder + 1;
    }

    storeUpdateLayer(draggedId, { sortOrder: newSortOrder });
    updateLayer(modelId, draggedId, { sortOrder: newSortOrder });
  }

  const dragState: DragState = {
    draggedId,
    dragOverId,
    dragOverPosition,
    onDragStart: setDraggedId,
    onDragOver: (id, pos) => { setDragOverId(id); setDragOverPosition(pos); },
    onDrop: handleDrop,
    onDragEnd: () => { setDraggedId(null); setDragOverId(null); },
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
            allLayersList={allLayersList}
            allObjects={objects}
            siblings={allRootLayers}
            dragState={dragState}
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
                allLayersList={allLayersList}
                storeUpdateObject={storeUpdateObject}
                selectObject={selectObject}
                dimmed={false}
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
  object, depth, modelId, allLayersList, storeUpdateObject, selectObject, dimmed,
}: {
  object: CanvasObject;
  depth: number;
  modelId: string;
  allLayersList: CanvasLayer[];
  storeUpdateObject: (id: string, fields: Partial<CanvasObject>) => void;
  selectObject: (id: string, additive?: boolean) => void;
  dimmed: boolean;
}) {
  async function handleLayerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newLayerId = e.target.value === "" ? null : e.target.value;
    storeUpdateObject(object.id, { layerId: newLayerId });
    await moveObjectToLayer(modelId, object.id, newLayerId);
  }

  return (
    <div
      className="flex items-center gap-2 border-b"
      style={{
        paddingLeft: `${20 + depth * 12}px`,
        paddingRight: "12px",
        paddingTop: "6px",
        paddingBottom: "6px",
        borderColor: "var(--border)",
        opacity: dimmed ? 0.4 : 1,
        cursor: "pointer",
      }}
      onClick={(e) => { if ((e.target as HTMLElement).tagName !== "SELECT") selectObject(object.id, e.shiftKey); }}
    >
      <span
        className="w-3 h-3 rounded-full shrink-0 border"
        style={{ background: object.fillColor, borderColor: object.lineColor }}
      />
      <span className="text-xs flex-1 truncate" style={{ color: "var(--text)" }}>{object.name}</span>
      <select
        value={object.layerId ?? ""}
        onChange={handleLayerChange}
        className="text-xs rounded px-1 py-0.5 max-w-[100px]"
        style={{
          background: "var(--surface-2)",
          color: "var(--text-muted)",
          border: "1px solid var(--border)",
        }}
        title="Move to layer"
      >
        <option value="">No layer</option>
        {allLayersList
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
      </select>
    </div>
  );
}

// --- Layer row ---

function LayerRow({
  layerId, depth, modelId, projectId,
  storeUpdateLayer, storeRemoveLayer, storeAddLayer, storeUpdateObject, selectObject,
  allLayers, allLayersList, allObjects, siblings, dragState, ancestorHidden,
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
  allLayersList: CanvasLayer[];
  allObjects: Record<string, CanvasObject>;
  siblings: CanvasLayer[];
  dragState: DragState;
  ancestorHidden: boolean;
}) {
  const layer = allLayers[layerId];
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!layer) return null;

  const children = Object.values(allLayers)
    .filter((l) => l.parentId === layerId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const layerObjects = Object.values(allObjects)
    .filter((o) => o.layerId === layerId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const isOver = dragState.dragOverId === layerId;
  const isDragging = dragState.draggedId === layerId;
  const effectivelyHidden = ancestorHidden || layer.hidden;

  const myIndex = siblings.findIndex((l) => l.id === layerId);
  const layerAbove = myIndex > 0 ? siblings[myIndex - 1] : null;

  const parentLayer = layer.parentId ? allLayers[layer.parentId] : null;
  const grandparentId = parentLayer?.parentId ?? null;
  const parentSiblings = Object.values(allLayers)
    .filter((l) => l.parentId === grandparentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

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
    if (!layerAbove) return;
    const aboveChildren = Object.values(allLayers)
      .filter((l) => l.parentId === layerAbove.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const newSortOrder =
      aboveChildren.length > 0 ? aboveChildren[aboveChildren.length - 1].sortOrder + 1 : 1;
    storeUpdateLayer(layerId, { parentId: layerAbove.id, sortOrder: newSortOrder });
    await updateLayer(modelId, layerId, { parentId: layerAbove.id, sortOrder: newSortOrder });
  }

  async function handleOutdent() {
    if (!parentLayer) return;
    const parentIndex = parentSiblings.findIndex((l) => l.id === parentLayer.id);
    const next = parentSiblings[parentIndex + 1];
    const newSortOrder = next
      ? (parentLayer.sortOrder + next.sortOrder) / 2
      : parentLayer.sortOrder + 1;
    storeUpdateLayer(layerId, { parentId: grandparentId, sortOrder: newSortOrder });
    await updateLayer(modelId, layerId, { parentId: grandparentId, sortOrder: newSortOrder });
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = "move";
    dragState.onDragStart(layerId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    dragState.onDragOver(layerId, position);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    dragState.onDrop(layerId, position, siblings);
    dragState.onDragEnd();
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
    allLayersList,
    allObjects,
    dragState,
    ancestorHidden: effectivelyHidden,
  };

  return (
    <div>
      <div
        draggable={!editing}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={dragState.onDragEnd}
        className="flex items-center gap-1 px-4 py-3 border-b"
        style={{
          paddingLeft: `${16 + depth * 12}px`,
          borderColor: "var(--border)",
          opacity: isDragging ? 0.4 : effectivelyHidden ? 0.45 : 1,
          cursor: editing ? "default" : "grab",
          borderTop:
            isOver && dragState.dragOverPosition === "before"
              ? "2px solid var(--accent)"
              : undefined,
          borderBottom:
            isOver && dragState.dragOverPosition === "after"
              ? "2px solid var(--accent)"
              : `1px solid var(--border)`,
        }}
      >
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
        {layerAbove && !editing && (
          <button
            onClick={handleIndent}
            className="text-sm px-1.5 py-0.5 rounded opacity-60 hover:opacity-100"
            style={{ color: "var(--text-muted)" }}
            title={`Make sub-layer of "${layerAbove.name}"`}
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

      {layerObjects.map((obj) => (
        <ObjectRow
          key={obj.id}
          object={obj}
          depth={depth + 1}
          modelId={modelId}
          allLayersList={allLayersList}
          storeUpdateObject={storeUpdateObject}
          selectObject={selectObject}
          dimmed={effectivelyHidden}
        />
      ))}

      {children.map((child) => (
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
