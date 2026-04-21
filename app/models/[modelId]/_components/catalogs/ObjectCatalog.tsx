"use client";

import { useState, useMemo, useRef } from "react";
import { useStore } from "@/store";
import { updateObject } from "@/actions/objects";
import CatalogHeader from "./CatalogHeader";

export default function ObjectCatalog() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const objects = useStore((s) => s.objects);
  const objectTypes = useStore((s) => s.objectTypes);
  const selectObject = useStore((s) => s.selectObject);
  const storeUpdateObject = useStore((s) => s.updateObject);
  const modelId = useStore((s) => s.modelId);
  const setPanOffset = useStore((s) => s.setPanOffset);
  const zoom = useStore((s) => s.zoom);
  const allPoints = useStore((s) => s.points);

  const filtered = useMemo(() =>
    Object.values(objects).filter((o) =>
      o.name.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name)),
    [objects, search]
  );

  function startEditing(objId: string, currentName: string) {
    setEditingId(objId);
    setEditName(currentName);
    setTimeout(() => editInputRef.current?.select(), 0);
  }

  async function commitRename() {
    const trimmed = editName.trim();
    if (editingId && trimmed && trimmed !== objects[editingId]?.name) {
      storeUpdateObject(editingId, { name: trimmed });
      await updateObject(modelId, editingId, { name: trimmed });
    }
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setEditingId(null);
  }

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
          <div
            key={obj.id}
            className="w-full text-left px-4 py-3.5 border-b flex items-start gap-2 hover:opacity-80 cursor-pointer"
            style={{ borderColor: "var(--border)" }}
            onClick={() => { if (editingId !== obj.id) { selectObject(obj.id); panToObject(obj.id); } }}
          >
            <span
              className="mt-0.5 w-3 h-3 rounded-full shrink-0 border"
              style={{ background: obj.fillColor, borderColor: obj.lineColor }}
            />
            <div className="min-w-0 flex-1">
              {editingId === obj.id ? (
                <input
                  ref={editInputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-1 rounded text-xs font-medium outline-none"
                  style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--accent)" }}
                />
              ) : (
                <div
                  className="text-xs font-medium truncate"
                  style={{ color: "var(--text)" }}
                  onDoubleClick={(e) => { e.stopPropagation(); startEditing(obj.id, obj.name); }}
                >{obj.name}</div>
              )}
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {obj.objectTypeId ? objectTypes[obj.objectTypeId]?.name : obj.kind}
                {obj.cost != null ? ` · $${obj.cost}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
