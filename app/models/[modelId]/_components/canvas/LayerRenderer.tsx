"use client";

import { useStore } from "@/store";
import ObjectRenderer from "./ObjectRenderer";

export default function LayerRenderer() {
  const objects = useStore((s) => s.objects);
  const layers = useStore((s) => s.layers);

  // Collect hidden layer ids (including children of hidden layers)
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

  const visibleObjects = Object.values(objects)
    .filter((o) => !o.layerId || !hiddenLayerIds.has(o.layerId))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      {visibleObjects.map((obj) => (
        <ObjectRenderer key={obj.id} objectId={obj.id} />
      ))}
    </>
  );
}
