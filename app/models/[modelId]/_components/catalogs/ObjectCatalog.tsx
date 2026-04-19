"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/store";
import CatalogHeader from "./CatalogHeader";

export default function ObjectCatalog() {
  const [search, setSearch] = useState("");
  const objects = useStore((s) => s.objects);
  const objectTypes = useStore((s) => s.objectTypes);
  const selectObject = useStore((s) => s.selectObject);
  const setPanOffset = useStore((s) => s.setPanOffset);
  const zoom = useStore((s) => s.zoom);
  const allPoints = useStore((s) => s.points);

  const filtered = useMemo(() =>
    Object.values(objects).filter((o) =>
      o.name.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name)),
    [objects, search]
  );

  function panToObject(objectId: string) {
    const pts = Object.values(allPoints).filter((p) => p.objectId === objectId);
    if (pts.length === 0) return;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    setPanOffset({ x: -cx * zoom + 200, y: -cy * zoom + 200 });
  }

  return (
    <div className="flex flex-col h-full">
      <CatalogHeader title="Objects" search={search} onSearch={setSearch} />
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs p-4" style={{ color: "var(--text-muted)" }}>No objects found.</p>
        )}
        {filtered.map((obj) => (
          <button
            key={obj.id}
            className="w-full text-left px-4 py-3.5 border-b flex items-start gap-2 hover:opacity-80"
            style={{ borderColor: "var(--border)" }}
            onClick={() => { selectObject(obj.id); panToObject(obj.id); }}
          >
            <span
              className="mt-0.5 w-3 h-3 rounded-full shrink-0 border"
              style={{ background: obj.fillColor, borderColor: obj.lineColor }}
            />
            <div className="min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>{obj.name}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {obj.objectTypeId ? objectTypes[obj.objectTypeId]?.name : obj.kind}
                {obj.cost != null ? ` · $${obj.cost}` : ""}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
