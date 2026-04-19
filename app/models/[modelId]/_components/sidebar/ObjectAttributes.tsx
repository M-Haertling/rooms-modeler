"use client";

import { useState } from "react";
import { useStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { updateObject, deleteObject, duplicateObject } from "@/actions/objects";
import { saveTemplate } from "@/actions/templates";
import { rotatePoint, boundingBox } from "@/lib/geometry";
import PanelSection from "./PanelSection";
import type { CanvasObject, CustomDim } from "@/types/canvas";

interface Props { objectId: string }

export default function ObjectAttributes({ objectId }: Props) {
  const obj = useStore((s) => s.objects[objectId]);
  const objPoints = useStore(
    useShallow((s) => Object.values(s.points).filter((p) => p.objectId === objectId))
  );
  const objTypes = useStore(useShallow((s) => Object.values(s.objectTypes)));
  const modelId = useStore((s) => s.modelId);
  const projectId = useStore((s) => s.projectId);
  const storeUpdateObject = useStore((s) => s.updateObject);
  const storeAddObject = useStore((s) => s.addObject);
  const storeRemoveObject = useStore((s) => s.removeObject);
  const setObjectRotation = useStore((s) => s.setObjectRotation);
  const setTemplates = useStore((s) => s.setTemplates);
  const templates = useStore((s) => s.templates);

  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  if (!obj) return null;

  async function patch(fields: Partial<CanvasObject>) {
    storeUpdateObject(objectId, fields);
    await updateObject(modelId, objectId, fields);
  }

  async function handleRotate(degrees: number) {
    const bbox = boundingBox(objPoints.map((p) => ({ x: p.x, y: p.y })));
    const center = { x: bbox.cx, y: bbox.cy };
    const updatedPoints = objPoints.map((p) => ({
      ...p,
      ...rotatePoint({ x: p.x, y: p.y }, center, degrees),
    }));
    setObjectRotation(objectId, (obj.rotation + degrees + 360) % 360, updatedPoints);
    await updateObject(modelId, objectId, { rotation: (obj.rotation + degrees + 360) % 360 });
    // Persist updated point positions
    for (const p of updatedPoints) {
      const { updatePoint } = await import("@/actions/objects");
      await updatePoint(modelId, p.id, p.x, p.y);
    }
  }

  async function handleDuplicate() {
    const result = await duplicateObject(modelId, objectId);
    storeAddObject(result.object, result.points, result.segments);
  }

  async function handleDelete() {
    storeRemoveObject(objectId);
    await deleteObject(modelId, objectId);
  }

  function addCustomDim() {
    const dims: CustomDim[] = [...obj.customDims, { label: "Custom", value: 0 }];
    patch({ customDims: dims });
  }

  function updateCustomDim(i: number, field: keyof CustomDim, val: string | number) {
    const dims = obj.customDims.map((d, idx) => idx === i ? { ...d, [field]: val } : d);
    patch({ customDims: dims });
  }

  function removeCustomDim(i: number) {
    patch({ customDims: obj.customDims.filter((_, idx) => idx !== i) });
  }

  return (
    <>
      <PanelSection title="Object">
        <Field label="Name">
          <input defaultValue={obj.name} onBlur={(e) => patch({ name: e.target.value })} className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Type">
          <select value={obj.objectTypeId ?? ""} onChange={(e) => patch({ objectTypeId: e.target.value || null })} className={inputCls} style={inputStyle}>
            <option value="">None</option>
            {objTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Notes">
          <textarea defaultValue={obj.notes ?? ""} onBlur={(e) => patch({ notes: e.target.value })} rows={2} className={inputCls + " resize-none"} style={inputStyle} />
        </Field>
        <Field label="URL">
          <input defaultValue={obj.url ?? ""} onBlur={(e) => patch({ url: e.target.value })} className={inputCls} style={inputStyle} />
        </Field>
      </PanelSection>

      <PanelSection title="Appearance">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Line color">
            <input type="color" value={obj.lineColor} onChange={(e) => patch({ lineColor: e.target.value })} className="w-full h-7 rounded cursor-pointer" style={{ background: "none", border: "1px solid var(--border)" }} />
          </Field>
          <Field label="Fill color">
            <input type="color" value={obj.fillColor} onChange={(e) => patch({ fillColor: e.target.value })} className="w-full h-7 rounded cursor-pointer" style={{ background: "none", border: "1px solid var(--border)" }} />
          </Field>
        </div>
        <Field label="Line thickness">
          <input type="range" min={0.5} max={5} step={0.5} value={obj.lineThickness} onChange={(e) => patch({ lineThickness: parseFloat(e.target.value) })} className="w-full" />
        </Field>
      </PanelSection>

      <PanelSection title="Dimensions">
        <Field label="Height (3D)">
          <input type="number" defaultValue={obj.height3d ?? ""} onBlur={(e) => patch({ height3d: parseFloat(e.target.value) || null })} className={inputCls} style={inputStyle} placeholder="Optional" />
        </Field>
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Custom dimensions</label>
          {obj.customDims.map((dim, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <input defaultValue={dim.label} onBlur={(e) => updateCustomDim(i, "label", e.target.value)} className={inputCls + " flex-1"} style={inputStyle} placeholder="Label" />
              <input type="number" defaultValue={dim.value} onBlur={(e) => updateCustomDim(i, "value", parseFloat(e.target.value))} className={inputCls + " w-20"} style={inputStyle} />
              <button onClick={() => removeCustomDim(i)} className="text-xs px-1" style={{ color: "var(--danger)" }}>×</button>
            </div>
          ))}
          <button onClick={addCustomDim} className="text-xs" style={{ color: "var(--accent)" }}>+ Add dimension</button>
        </div>
      </PanelSection>

      <PanelSection title="Details">
        <Field label="Cost ($)">
          <input type="number" defaultValue={obj.cost ?? ""} onBlur={(e) => patch({ cost: parseFloat(e.target.value) || null })} className={inputCls} style={inputStyle} placeholder="0.00" />
        </Field>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text)" }}>Owned</span>
          <Toggle value={obj.owned} onChange={() => patch({ owned: !obj.owned })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text)" }}>Locked</span>
          <Toggle value={obj.locked} onChange={() => patch({ locked: !obj.locked })} />
        </div>
      </PanelSection>

      <PanelSection title="Actions">
        <div className="flex gap-2">
          <button onClick={() => handleRotate(-90)} className="flex-1 py-1 rounded text-xs" style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}>↺ 90°</button>
          <button onClick={() => handleRotate(90)} className="flex-1 py-1 rounded text-xs" style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}>↻ 90°</button>
        </div>
        <button onClick={handleDuplicate} className="w-full py-1.5 rounded text-xs" style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}>Duplicate</button>
        <button
          onClick={() => { setTemplateName(obj.name); setSavingTemplate(true); }}
          className="w-full py-1.5 rounded text-xs"
          style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
        >Save as template</button>
        <button onClick={handleDelete} className="w-full py-1.5 rounded text-xs" style={{ background: "rgba(255,68,68,0.1)", color: "var(--danger)", border: "1px solid rgba(255,68,68,0.3)" }}>Delete</button>
      </PanelSection>

      {savingTemplate && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-lg p-6 w-72 space-y-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Save as template</h2>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Template name</label>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full px-2 py-1 rounded text-xs outline-none"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSavingTemplate(false)} className="flex-1 py-1.5 rounded text-xs" style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Cancel</button>
              <button
                onClick={async () => {
                  const tmpl = await saveTemplate(modelId, objectId, templateName || obj.name);
                  setTemplates([tmpl, ...templates]);
                  setSavingTemplate(false);
                }}
                className="flex-1 py-1.5 rounded text-xs font-medium"
                style={{ background: "var(--accent)", color: "#fff" }}
              >Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputCls = "w-full px-2 py-1 rounded text-xs outline-none";
const inputStyle = { background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" } as React.CSSProperties;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="w-10 h-5 rounded-full relative transition-colors" style={{ background: value ? "var(--accent)" : "var(--border)" }}>
      <span className="absolute top-0.5 w-4 h-4 rounded-full transition-transform" style={{ background: "#fff", left: value ? "calc(100% - 18px)" : "2px" }} />
    </button>
  );
}
