"use client";

import { useStore } from "@/store";
import ObjectRenderer from "./ObjectRenderer";

export default function LayerRenderer() {
  const objects = useStore((s) => s.objects);
  const layers = useStore((s) => s.layers);

  // Build hidden layer set (cascade to children)
  const hiddenLayerIds = new Set<string>();
  function markHidden(layerId: string) {
    hiddenLayerIds.add(layerId);
    for (const l of Object.values(layers)) {
      if (l.parentId === layerId) markHidden(l.id);
    }
  }
  for (const l of Object.values(layers)) {
    if (l.hidden) markHidden(l.id);
  }

  // Collect object render order: ascending sortOrder = rendered first = behind.
  // Catalog displays descending (top = in front), so ascending render = bottom-of-catalog first.
  function collectObjectTree(objectId: string): string[] {
    const obj = objects[objectId];
    if (!obj || obj.hidden) return [];
    const result = [objectId];
    const children = Object.values(objects)
      .filter((o) => o.parentObjectId === objectId && !o.hidden)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (const child of children) {
      result.push(...collectObjectTree(child.id));
    }
    return result;
  }

  function collectLayerTree(parentLayerId: string | null): string[] {
    const childLayers = Object.values(layers)
      .filter((l) => l.parentId === parentLayerId && !hiddenLayerIds.has(l.id))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const result: string[] = [];
    for (const layer of childLayers) {
      const rootObjects = Object.values(objects)
        .filter((o) => o.layerId === layer.id && !o.parentObjectId && !o.hidden)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      for (const obj of rootObjects) {
        result.push(...collectObjectTree(obj.id));
      }
      result.push(...collectLayerTree(layer.id));
    }
    return result;
  }

  // Unassigned objects (no layer, no parent) render first (behind everything)
  const unassigned = Object.values(objects)
    .filter((o) => !o.layerId && !o.parentObjectId && !o.hidden)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const renderOrder = [
    ...unassigned.map((o) => o.id),
    ...collectLayerTree(null),
  ];

  return (
    <>
      {renderOrder.map((id) => (
        <ObjectRenderer key={id} objectId={id} />
      ))}
    </>
  );
}
