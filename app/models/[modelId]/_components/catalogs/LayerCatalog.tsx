"use client";

import { useState, useMemo, useRef } from "react";
import { useStore } from "@/store";
import { createLayer, updateLayer, deleteLayer } from "@/actions/layers";
import CatalogHeader from "./CatalogHeader";
import type { CanvasLayer } from "@/types/canvas";

interface DragState {
  draggedId: string | null;
  dragOverId: string | null;
  dragOverPosition: "before" | "after";
  onDragStart: (id: string) => void;
  onDragOver: (id: string, position: "before" | "after") => void;
  onDrop: (targetId: string, position: "before" | "after", siblings: CanvasLayer[]) => void;
  onDragEnd: () => void;
}

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

  async function handleCreate() {
    const layer = await createLayer(modelId, projectId, "New layer");
    storeAddLayer(layer);
  }

  function calcLayerCost(layerId: string): number {
    const directCost = Object.values(objects)
      .filter((o) => o.layerId === layerId)
      .reduce((s, o) => s + (o.cost ?? 0), 0);
    const childCost = Object.values(layers)
      .filter((l) => l.parentId === layerId)
      .reduce((s, l) => s + calcLayerCost(l.id), 0);
    return directCost + childCost;
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
    onDragOver: (id, pos) => {
      setDragOverId(id);
      setDragOverPosition(pos);
    },
    onDrop: handleDrop,
    onDragEnd: () => {
      setDraggedId(null);
      setDragOverId(null);
    },
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
            cost={calcLayerCost(layer.id)}
            modelId={modelId}
            projectId={projectId}
            storeUpdateLayer={storeUpdateLayer}
            storeRemoveLayer={storeRemoveLayer}
            storeAddLayer={storeAddLayer}
            allLayers={layers}
            siblings={allRootLayers}
            dragState={dragState}
          />
        ))}
        {rootLayers.length === 0 && (
          <p className="text-xs p-4" style={{ color: "var(--text-muted)" }}>
            No layers yet.
          </p>
        )}
      </div>
    </div>
  );
}

function LayerRow({
  layerId,
  depth,
  cost,
  modelId,
  projectId,
  storeUpdateLayer,
  storeRemoveLayer,
  storeAddLayer,
  allLayers,
  siblings,
  dragState,
}: {
  layerId: string;
  depth: number;
  cost: number;
  modelId: string;
  projectId: string;
  storeUpdateLayer: (id: string, fields: Partial<CanvasLayer>) => void;
  storeRemoveLayer: (id: string) => void;
  storeAddLayer: (l: CanvasLayer) => void;
  allLayers: Record<string, CanvasLayer>;
  siblings: CanvasLayer[];
  dragState: DragState;
}) {
  const layer = allLayers[layerId];
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!layer) return null;

  const children = Object.values(allLayers)
    .filter((l) => l.parentId === layerId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const isOver = dragState.dragOverId === layerId;
  const isDragging = dragState.draggedId === layerId;

  // The sibling immediately above this layer (for indent operation)
  const myIndex = siblings.findIndex((l) => l.id === layerId);
  const layerAbove = myIndex > 0 ? siblings[myIndex - 1] : null;

  // For outdent: parent and grandparent-level siblings
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
    // Focus after render
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
      aboveChildren.length > 0
        ? aboveChildren[aboveChildren.length - 1].sortOrder + 1
        : 1;
    storeUpdateLayer(layerId, { parentId: layerAbove.id, sortOrder: newSortOrder });
    await updateLayer(modelId, layerId, { parentId: layerAbove.id, sortOrder: newSortOrder });
  }

  async function handleOutdent() {
    if (!parentLayer) return;
    // Place just after the parent in the grandparent-level sibling list
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
          opacity: isDragging ? 0.4 : 1,
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
          className="text-sm w-5 shrink-0"
          style={{ color: layer.hidden ? "var(--text-muted)" : "var(--text)" }}
        >
          {layer.hidden ? "○" : "●"}
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
            style={{ color: layer.hidden ? "var(--text-muted)" : "var(--text)", cursor: "text" }}
            onDoubleClick={startEditing}
            title="Double-click to rename"
          >
            {layer.name}
          </span>
        )}

        {cost > 0 && (
          <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
            ${cost.toFixed(0)}
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
      {children.map((child) => (
        <LayerRow
          key={child.id}
          layerId={child.id}
          depth={depth + 1}
          cost={0}
          modelId={modelId}
          projectId={projectId}
          storeUpdateLayer={storeUpdateLayer}
          storeRemoveLayer={storeRemoveLayer}
          storeAddLayer={storeAddLayer}
          allLayers={allLayers}
          siblings={children}
          dragState={dragState}
        />
      ))}
    </div>
  );
}
