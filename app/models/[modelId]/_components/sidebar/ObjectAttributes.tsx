"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { updateObject, deleteObject, duplicateObject, updatePoint } from "@/actions/objects";
import { saveTemplate } from "@/actions/templates";
import { rotatePoint, boundingBox } from "@/lib/geometry";
import { formatLength, splitLengthFromFeet, compoundLengthToFeet } from "@/lib/units";
import PanelSection from "./PanelSection";
import type { CanvasObject, CustomDim, Unit } from "@/types/canvas";

interface Props { objectId: string }

export default function ObjectAttributes({ objectId }: Props) {
  const obj = useStore((s) => s.objects[objectId]);
  const objPoints = useStore(
    useShallow((s) => Object.values(s.points).filter((p) => p.objectId === objectId))
  );
  const objTypes = useStore(useShallow((s) => Object.values(s.objectTypes)));
  const modelId = useStore((s) => s.modelId);
  const projectId = useStore((s) => s.projectId);
  const unit = useStore((s) => s.unit);
  const storeUpdateObject = useStore((s) => s.updateObject);
  const storeAddObject = useStore((s) => s.addObject);
  const storeRemoveObject = useStore((s) => s.removeObject);
  const movePoint = useStore((s) => s.movePoint);
  const setObjectRotation = useStore((s) => s.setObjectRotation);
  const setTemplates = useStore((s) => s.setTemplates);
  const templates = useStore((s) => s.templates);

  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [nameValue, setNameValue] = useState(obj?.name ?? "");
  const [rotationValue, setRotationValue] = useState(String(obj?.rotation ?? 0));
  const [editingRx, setEditingRx] = useState(false);
  const [rxFt, setRxFt] = useState("0");
  const [rxIn, setRxIn] = useState("0");
  const [editingRy, setEditingRy] = useState(false);
  const [ryFt, setRyFt] = useState("0");
  const [ryIn, setRyIn] = useState("0");
  const [editingW, setEditingW] = useState(false);
  const [wFt, setWFt] = useState("0");
  const [wIn, setWIn] = useState("0");
  const [editingH, setEditingH] = useState(false);
  const [hFt, setHFt] = useState("0");
  const [hIn, setHIn] = useState("0");
  const nameRef = useRef<HTMLInputElement>(null);
  const pendingNameRef = useRef<{ objectId: string; modelId: string; value: string; savedName: string } | null>(null);

  useEffect(() => { setNameValue(obj?.name ?? ""); }, [objectId, obj?.name]);
  useEffect(() => { setRotationValue(String(obj?.rotation ?? 0)); }, [objectId, obj?.rotation]);
  useEffect(() => { setEditingRx(false); setEditingRy(false); setEditingW(false); setEditingH(false); }, [objectId]);

  const storeUpdateObjectRef = useRef(storeUpdateObject);
  storeUpdateObjectRef.current = storeUpdateObject;

  useEffect(() => {
    return () => {
      const p = pendingNameRef.current;
      if (!p) return;
      const trimmed = p.value.trim();
      if (trimmed && trimmed !== p.savedName) {
        storeUpdateObjectRef.current(p.objectId, { name: trimmed });
        updateObject(p.modelId, p.objectId, { name: trimmed });
      }
    };
  }, []);

  if (!obj) return null;

  // Ellipse geometry — only used when obj.kind === "round"
  const ellipseBbox = obj.kind === "round" && objPoints.length >= 2
    ? boundingBox(objPoints.map((p) => ({ x: p.x, y: p.y })))
    : null;
  const cx = ellipseBbox?.cx ?? 0;
  const cy = ellipseBbox?.cy ?? 0;
  const rx = (ellipseBbox?.width ?? 0) / 2;
  const ry = (ellipseBbox?.height ?? 0) / 2;

  // Bounding box geometry — only used when obj.kind === "standard"
  const standardBbox = obj.kind === "standard" && objPoints.length >= 2
    ? boundingBox(objPoints.map((p) => ({ x: p.x, y: p.y })))
    : null;
  const bboxCx = standardBbox?.cx ?? 0;
  const bboxCy = standardBbox?.cy ?? 0;
  const bboxW = standardBbox?.width ?? 0;
  const bboxH = standardBbox?.height ?? 0;

  async function applyRx() {
    const newRx = compoundLengthToFeet(parseFloat(rxFt) || 0, parseFloat(rxIn) || 0, unit);
    if (isNaN(newRx) || newRx <= 0) { setEditingRx(false); return; }
    const cardinals = getCardinalIds(objPoints, cx, cy);
    if (cardinals.e) { movePoint(cardinals.e, cx + newRx, cy); await updatePoint(modelId, cardinals.e, cx + newRx, cy); }
    if (cardinals.w) { movePoint(cardinals.w, cx - newRx, cy); await updatePoint(modelId, cardinals.w, cx - newRx, cy); }
    setEditingRx(false);
  }

  async function applyRy() {
    const newRy = compoundLengthToFeet(parseFloat(ryFt) || 0, parseFloat(ryIn) || 0, unit);
    if (isNaN(newRy) || newRy <= 0) { setEditingRy(false); return; }
    const cardinals = getCardinalIds(objPoints, cx, cy);
    if (cardinals.n) { movePoint(cardinals.n, cx, cy - newRy); await updatePoint(modelId, cardinals.n, cx, cy - newRy); }
    if (cardinals.s) { movePoint(cardinals.s, cx, cy + newRy); await updatePoint(modelId, cardinals.s, cx, cy + newRy); }
    setEditingRy(false);
  }

  async function applyWidth() {
    const newW = compoundLengthToFeet(parseFloat(wFt) || 0, parseFloat(wIn) || 0, unit);
    if (isNaN(newW) || newW <= 0 || !standardBbox || bboxW <= 0) { setEditingW(false); return; }
    const scaleX = newW / bboxW;
    for (const p of objPoints) {
      const newX = bboxCx + (p.x - bboxCx) * scaleX;
      movePoint(p.id, newX, p.y);
      await updatePoint(modelId, p.id, newX, p.y);
    }
    setEditingW(false);
  }

  async function applyHeight() {
    const newH = compoundLengthToFeet(parseFloat(hFt) || 0, parseFloat(hIn) || 0, unit);
    if (isNaN(newH) || newH <= 0 || !standardBbox || bboxH <= 0) { setEditingH(false); return; }
    const scaleY = newH / bboxH;
    for (const p of objPoints) {
      const newY = bboxCy + (p.y - bboxCy) * scaleY;
      movePoint(p.id, p.x, newY);
      await updatePoint(modelId, p.id, p.x, newY);
    }
    setEditingH(false);
  }

  function commitName() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== obj.name) patch({ name: trimmed });
    pendingNameRef.current = null;
  }

  function handleNameChange(value: string) {
    setNameValue(value);
    pendingNameRef.current = { objectId, modelId, value, savedName: obj.name };
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.currentTarget.blur(); commitName(); }
    if (e.key === "Escape") { setNameValue(obj.name); pendingNameRef.current = null; e.currentTarget.blur(); }
  }

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
    for (const p of updatedPoints) {
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
          <input
            ref={nameRef}
            value={nameValue}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={commitName}
            onKeyDown={handleNameKeyDown}
            className={inputCls}
            style={inputStyle}
          />
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
            <div className="flex gap-1 items-center">
              <input
                type="color"
                value={obj.fillColor}
                onChange={(e) => patch({ fillColor: e.target.value })}
                disabled={!obj.fillEnabled}
                className="flex-1 h-7 rounded cursor-pointer"
                style={{ background: "none", border: "1px solid var(--border)", opacity: obj.fillEnabled ? 1 : 0.4 }}
              />
              <Toggle value={obj.fillEnabled} onChange={() => patch({ fillEnabled: !obj.fillEnabled })} />
            </div>
          </Field>
        </div>
        {obj.fillEnabled && (
          <Field label="Fill opacity">
            <div className="flex gap-2 items-center">
              <input
                type="range" min={0} max={1} step={0.01}
                value={obj.fillOpacity}
                onChange={(e) => patch({ fillOpacity: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <span className="text-xs w-8 text-right" style={{ color: "var(--text-muted)" }}>
                {Math.round(obj.fillOpacity * 100)}%
              </span>
            </div>
          </Field>
        )}
        <Field label="Line thickness">
          <input type="range" min={0.5} max={5} step={0.5} value={obj.lineThickness} onChange={(e) => patch({ lineThickness: parseFloat(e.target.value) })} className="w-full" />
        </Field>
      </PanelSection>

      <PanelSection title="Dimensions">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text)" }}>Show dimensions</span>
          <Toggle value={obj.showDimensions} onChange={() => patch({ showDimensions: !obj.showDimensions })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text)" }}>Show name</span>
          <Toggle value={obj.showName} onChange={() => patch({ showName: !obj.showName })} />
        </div>

        {obj.kind === "standard" && standardBbox && (
          <>
            <RadiusField
              label="Width"
              editing={editingW}
              primaryVal={wFt} onPrimaryChange={setWFt}
              secondaryVal={wIn} onSecondaryChange={setWIn}
              unit={unit}
              displayValue={formatLength(bboxW, unit)}
              locked={obj.locked}
              onStartEdit={() => {
                const { primary, secondary } = splitLengthFromFeet(bboxW, unit);
                setWFt(String(primary)); setWIn(String(secondary)); setEditingW(true);
              }}
              onApply={applyWidth}
              onCancel={() => setEditingW(false)}
            />
            <RadiusField
              label="Height"
              editing={editingH}
              primaryVal={hFt} onPrimaryChange={setHFt}
              secondaryVal={hIn} onSecondaryChange={setHIn}
              unit={unit}
              displayValue={formatLength(bboxH, unit)}
              locked={obj.locked}
              onStartEdit={() => {
                const { primary, secondary } = splitLengthFromFeet(bboxH, unit);
                setHFt(String(primary)); setHIn(String(secondary)); setEditingH(true);
              }}
              onApply={applyHeight}
              onCancel={() => setEditingH(false)}
            />
          </>
        )}

        {obj.kind === "round" && (
          <>
            <RadiusField
              label="Radius X"
              editing={editingRx}
              primaryVal={rxFt} onPrimaryChange={setRxFt}
              secondaryVal={rxIn} onSecondaryChange={setRxIn}
              unit={unit}
              displayValue={formatLength(rx, unit)}
              locked={obj.locked}
              onStartEdit={() => {
                const { primary, secondary } = splitLengthFromFeet(rx, unit);
                setRxFt(String(primary)); setRxIn(String(secondary)); setEditingRx(true);
              }}
              onApply={applyRx}
              onCancel={() => setEditingRx(false)}
            />
            <RadiusField
              label="Radius Y"
              editing={editingRy}
              primaryVal={ryFt} onPrimaryChange={setRyFt}
              secondaryVal={ryIn} onSecondaryChange={setRyIn}
              unit={unit}
              displayValue={formatLength(ry, unit)}
              locked={obj.locked}
              onStartEdit={() => {
                const { primary, secondary } = splitLengthFromFeet(ry, unit);
                setRyFt(String(primary)); setRyIn(String(secondary)); setEditingRy(true);
              }}
              onApply={applyRy}
              onCancel={() => setEditingRy(false)}
            />
          </>
        )}

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
        <Field label="Rotation">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleRotate(-90)}
              className="px-2 py-1 rounded text-xs"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
            >↺</button>
            <input
              type="number"
              value={rotationValue}
              onChange={(e) => setRotationValue(e.target.value)}
              onBlur={() => {
                const deg = parseFloat(rotationValue);
                if (isNaN(deg)) { setRotationValue(String(obj.rotation)); return; }
                const normalized = ((deg % 360) + 360) % 360;
                const delta = normalized - obj.rotation;
                if (Math.abs(delta) > 0.001) handleRotate(delta);
                setRotationValue(String(normalized));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") { setRotationValue(String(obj.rotation)); e.currentTarget.blur(); }
              }}
              className={inputCls + " flex-1 text-center"}
              style={inputStyle}
            />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>°</span>
            <button
              onClick={() => handleRotate(90)}
              className="px-2 py-1 rounded text-xs"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
            >↻</button>
          </div>
        </Field>
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

function RadiusField({
  label, editing, primaryVal, onPrimaryChange, secondaryVal, onSecondaryChange,
  unit, displayValue, locked, onStartEdit, onApply, onCancel,
}: {
  label: string; editing: boolean;
  primaryVal: string; onPrimaryChange: (v: string) => void;
  secondaryVal: string; onSecondaryChange: (v: string) => void;
  unit: Unit; displayValue: string; locked: boolean;
  onStartEdit: () => void; onApply: () => void; onCancel: () => void;
}) {
  return (
    <div>
      <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      <div className="flex items-center gap-1.5">
        {editing ? (
          <div
            className="flex items-center gap-1 flex-1"
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) onApply(); }}
          >
            <input
              autoFocus value={primaryVal} onChange={(e) => onPrimaryChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onApply(); if (e.key === "Escape") onCancel(); }}
              className="w-0 flex-1 px-2 py-1 rounded text-xs outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--accent)" }}
            />
            <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{unit === "standard" ? "ft" : "m"}</span>
            <input
              value={secondaryVal} onChange={(e) => onSecondaryChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onApply(); if (e.key === "Escape") onCancel(); }}
              className="w-0 flex-1 px-2 py-1 rounded text-xs outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--accent)" }}
            />
            <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{unit === "standard" ? "in" : "cm"}</span>
          </div>
        ) : (
          <button
            disabled={locked}
            className="flex-1 text-left px-2 py-1 rounded text-xs"
            style={{
              background: "var(--surface-2)",
              color: locked ? "var(--text-muted)" : "var(--text)",
              border: "1px solid var(--border)",
              cursor: locked ? "default" : "pointer",
            }}
            onClick={onStartEdit}
          >
            {displayValue}
          </button>
        )}
      </div>
    </div>
  );
}

function getCardinalIds(
  pts: Array<{ id: string; x: number; y: number }>,
  cx: number,
  cy: number
): { n?: string; s?: string; e?: string; w?: string } {
  const ids: { n?: string; s?: string; e?: string; w?: string } = {};
  for (const p of pts) {
    const dx = p.x - cx; const dy = p.y - cy;
    if (Math.abs(dy) > Math.abs(dx) && dy < 0) ids.n = p.id;
    else if (Math.abs(dy) > Math.abs(dx) && dy > 0) ids.s = p.id;
    else if (dx > 0) ids.e = p.id;
    else ids.w = p.id;
  }
  return ids;
}
