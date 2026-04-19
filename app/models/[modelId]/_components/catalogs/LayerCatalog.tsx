"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/store";
import { createLayer, updateLayer, deleteLayer } from "@/actions/layers";
import CatalogHeader from "./CatalogHeader";
import type { CanvasLayer } from "@/types/canvas";

export default function LayerCatalog() {
  const [search, setSearch] = useState("");
  const layers = useStore((s) => s.layers);
  const objects = useStore((s) => s.objects);
  const modelId = useStore((s) => s.modelId);
  const projectId = useStore((s) => s.projectId);
  const storeAddLayer = useStore((s) => s.addLayer);
  const storeUpdateLayer = useStore((s) => s.updateLayer);
  const storeRemoveLayer = useStore((s) => s.removeLayer);

  const rootLayers = useMemo(
    () => Object.values(layers)
      .filter((l) => !l.parentId && l.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [layers, search]
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

  return (
    <div className="flex flex-col h-full">
      <CatalogHeader title="Layers" search={search} onSearch={setSearch} />
      <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <button onClick={handleCreate} className="text-xs" style={{ color: "var(--accent)" }}>+ New layer</button>
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
          />
        ))}
        {rootLayers.length === 0 && (
          <p className="text-xs p-4" style={{ color: "var(--text-muted)" }}>No layers yet.</p>
        )}
      </div>
    </div>
  );
}

function LayerRow({
  layerId, depth, cost, modelId, projectId,
  storeUpdateLayer, storeRemoveLayer, storeAddLayer, allLayers,
}: {
  layerId: string; depth: number; cost: number; modelId: string; projectId: string;
  storeUpdateLayer: (id: string, fields: Partial<CanvasLayer>) => void;
  storeRemoveLayer: (id: string) => void;
  storeAddLayer: (l: CanvasLayer) => void;
  allLayers: Record<string, CanvasLayer>;
}) {
  const layer = allLayers[layerId];
  if (!layer) return null;

  const children = Object.values(allLayers)
    .filter((l) => l.parentId === layerId)
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

  return (
    <div>
      <div
        className="flex items-center gap-1 px-4 py-2 border-b"
        style={{ paddingLeft: `${16 + depth * 12}px`, borderColor: "var(--border)" }}
      >
        <button onClick={toggleHidden} className="text-xs w-4" style={{ color: layer.hidden ? "var(--text-muted)" : "var(--text)" }}>
          {layer.hidden ? "○" : "●"}
        </button>
        <span className="text-xs flex-1 truncate" style={{ color: layer.hidden ? "var(--text-muted)" : "var(--text)" }}>{layer.name}</span>
        {cost > 0 && <span className="text-xs" style={{ color: "var(--text-muted)" }}>${cost.toFixed(0)}</span>}
        <button onClick={handleAddChild} className="text-xs opacity-60 hover:opacity-100" style={{ color: "var(--accent)" }} title="Add sub-layer">+</button>
        <button onClick={handleDelete} className="text-xs opacity-60 hover:opacity-100" style={{ color: "var(--danger)" }}>×</button>
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
        />
      ))}
    </div>
  );
}
