"use client";

import { useStore } from "@/store";
import ObjectCatalog from "./ObjectCatalog";
import TemplateCatalog from "./TemplateCatalog";
import LayerCatalog from "./LayerCatalog";

export default function CatalogDrawer() {
  const activeCatalog = useStore((s) => s.activeCatalog);

  if (!activeCatalog) return null;

  return (
    <aside
      className="w-64 shrink-0 overflow-y-auto border-r flex flex-col"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {activeCatalog === "objects" && <ObjectCatalog />}
      {activeCatalog === "templates" && <TemplateCatalog />}
      {activeCatalog === "layers" && <LayerCatalog />}
    </aside>
  );
}
