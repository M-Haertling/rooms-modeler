"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/store";
import { instantiateFromTemplate, deleteTemplate } from "@/actions/templates";
import CatalogHeader from "./CatalogHeader";
import type { Template } from "@/types/canvas";

export default function TemplateCatalog() {
  const [search, setSearch] = useState("");
  const [instantiating, setInstantiating] = useState<Template | null>(null);
  const [newName, setNewName] = useState("");
  const [newW, setNewW] = useState(2);
  const [newH, setNewH] = useState(2);

  const templates = useStore((s) => s.templates);
  const setTemplates = useStore((s) => s.setTemplates);
  const modelId = useStore((s) => s.modelId);
  const addObject = useStore((s) => s.addObject);
  const panOffset = useStore((s) => s.panOffset);
  const zoom = useStore((s) => s.zoom);

  const filtered = useMemo(() =>
    templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [templates, search]
  );

  async function handleInstantiate() {
    if (!instantiating) return;
    const ox = (-panOffset.x / zoom) + 3;
    const oy = (-panOffset.y / zoom) + 3;
    const result = await instantiateFromTemplate(modelId, instantiating.id, {
      name: newName || instantiating.name,
      width: newW, height: newH,
      originX: ox, originY: oy,
      layerId: null,
    });
    addObject(result.object, result.points, result.segments);
    setInstantiating(null);
  }

  async function handleDelete(id: string) {
    await deleteTemplate(modelId, id);
    setTemplates(templates.filter((t) => t.id !== id));
  }

  return (
    <div className="flex flex-col h-full">
      <CatalogHeader title="Templates" search={search} onSearch={setSearch} />
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs p-4" style={{ color: "var(--text-muted)" }}>No templates. Select an object and save it as a template.</p>
        )}
        {filtered.map((t) => (
          <div key={t.id} className="px-4 py-3.5 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>{t.name}</div>
              <div className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{t.kind}</div>
            </div>
            <button
              onClick={() => { setInstantiating(t); setNewName(t.name); setNewW(2); setNewH(2); }}
              className="text-xs px-2 py-1 rounded"
              style={{ background: "var(--accent)", color: "#fff" }}
            >Use</button>
            <button onClick={() => handleDelete(t.id)} className="text-xs px-1.5 py-1 rounded" style={{ color: "var(--danger)" }}>×</button>
          </div>
        ))}
      </div>

      {instantiating && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-lg p-6 w-72 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Use template: {instantiating.name}</h2>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-2 py-1 rounded text-xs outline-none" style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Width (units)</label>
                <input type="number" value={newW} min={0.1} step={0.5} onChange={(e) => setNewW(parseFloat(e.target.value) || 1)} className="w-full px-2 py-1 rounded text-xs outline-none" style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Height (units)</label>
                <input type="number" value={newH} min={0.1} step={0.5} onChange={(e) => setNewH(parseFloat(e.target.value) || 1)} className="w-full px-2 py-1 rounded text-xs outline-none" style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setInstantiating(null)} className="flex-1 py-1.5 rounded text-xs" style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={handleInstantiate} className="flex-1 py-1.5 rounded text-xs font-medium" style={{ background: "var(--accent)", color: "#fff" }}>Place</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
