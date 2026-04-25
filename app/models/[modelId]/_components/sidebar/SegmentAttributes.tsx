"use client";

import { useState } from "react";
import { useStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { updateSegment, updatePoint, splitSegment } from "@/actions/objects";
import { distance, normalize, add, scale, subtract } from "@/lib/geometry";
import { formatLength, splitLengthFromFeet, compoundLengthToFeet } from "@/lib/units";
import PanelSection from "./PanelSection";

interface Props { segmentIds: string[] }

function getMixed<T>(values: T[]): T | "mixed" {
  if (values.length === 0) return "mixed";
  return values.every((v) => v === values[0]) ? values[0] : "mixed";
}

export default function SegmentAttributes({ segmentIds }: Props) {
  const allSegments = useStore(useShallow((s) => s.segments));
  const allPoints = useStore(useShallow((s) => s.points));
  const unit = useStore((s) => s.unit);
  const modelId = useStore((s) => s.modelId);
  const storeUpdateSegment = useStore((s) => s.updateSegment);
  const movePoint = useStore((s) => s.movePoint);
  const splitSegmentInStore = useStore((s) => s.splitSegmentInStore);
  const pushHistory = useStore((s) => s.pushHistory);

  const [lengthFt, setLengthFt] = useState("0");
  const [lengthIn, setLengthIn] = useState("0");
  const [editingLength, setEditingLength] = useState(false);
  const [angleInput, setAngleInput] = useState("");
  const [editingAngle, setEditingAngle] = useState(false);

  const segs = segmentIds.map((id) => allSegments[id]).filter(Boolean);
  if (segs.length === 0) return null;

  const single = segs.length === 1;
  const seg = segs[0];

  const ptA = allPoints[seg.pointAId];
  const ptB = allPoints[seg.pointBId];

  // Derived values for single segment
  const len = single && ptA && ptB ? distance({ x: ptA.x, y: ptA.y }, { x: ptB.x, y: ptB.y }) : null;
  const angleDeg = single && ptA && ptB
    ? (Math.atan2(ptB.y - ptA.y, ptB.x - ptA.x) * 180) / Math.PI
    : null;

  // Mixed value checks
  const nameVal = getMixed(segs.map((s) => s.name ?? ""));
  const lockedVal = getMixed(segs.map((s) => s.locked));
  const angleLocked = getMixed(segs.map((s) => s.angleLocked));
  const transparentVal = getMixed(segs.map((s) => s.transparent));
  const segTypeVal = getMixed(segs.map((s) => s.segmentType));
  const showDimVal = getMixed(segs.map((s) => s.showDimensions));
  const doorHingeVal = getMixed(segs.map((s) => s.doorHingeSide));
  const doorSwingVal = getMixed(segs.map((s) => s.doorSwingIn));
  const allDoors = segs.every((s) => s.segmentType === "door");

  async function toggleAll(field: keyof typeof seg) {
    const current = getMixed(segs.map((s) => s[field] as boolean));
    const val = current === true ? false : true;
    for (const s of segs) {
      storeUpdateSegment(s.id, { [field]: val });
      await updateSegment(modelId, s.id, { [field]: val });
    }
  }

  async function setAllSegmentType(type: "solid" | "door" | "window") {
    for (const s of segs) {
      storeUpdateSegment(s.id, { segmentType: type, transparent: false });
      await updateSegment(modelId, s.id, { segmentType: type, transparent: false });
    }
  }

  async function setAllEmpty() {
    for (const s of segs) {
      storeUpdateSegment(s.id, { transparent: true });
      await updateSegment(modelId, s.id, { transparent: true });
    }
  }

  async function setAllDoorHingeSide(value: "left" | "right") {
    for (const s of segs) {
      storeUpdateSegment(s.id, { doorHingeSide: value });
      await updateSegment(modelId, s.id, { doorHingeSide: value });
    }
  }

  async function setAllDoorSwingIn(value: boolean) {
    for (const s of segs) {
      storeUpdateSegment(s.id, { doorSwingIn: value });
      await updateSegment(modelId, s.id, { doorSwingIn: value });
    }
  }

  async function applyAngle() {
    if (!single || !ptA || !ptB || len === null) return;
    const newAngleDeg = parseFloat(angleInput);
    if (isNaN(newAngleDeg)) return;

    const newAngleRad = (newAngleDeg * Math.PI) / 180;
    const newDir = { x: Math.cos(newAngleRad), y: Math.sin(newAngleRad) };
    const bFullyLocked = ptB.xLocked && ptB.yLocked;
    const aFullyLocked = ptA.xLocked && ptA.yLocked;
    if (!bFullyLocked) {
      const newB = add({ x: ptA.x, y: ptA.y }, scale(newDir, len));
      movePoint(seg.pointBId, newB.x, newB.y);
      await updatePoint(modelId, seg.pointBId, newB.x, newB.y);
    } else if (!aFullyLocked) {
      const newA = subtract({ x: ptB.x, y: ptB.y }, scale(newDir, len));
      movePoint(seg.pointAId, newA.x, newA.y);
      await updatePoint(modelId, seg.pointAId, newA.x, newA.y);
    }
    setEditingAngle(false);
  }

  async function applyLength() {
    if (!single || !ptA || !ptB || len === null) return;
    const primary = parseFloat(lengthFt) || 0;
    const secondary = parseFloat(lengthIn) || 0;
    const newLen = compoundLengthToFeet(primary, secondary, unit);
    if (isNaN(newLen) || newLen <= 0) return;

    const bFullyLocked = ptB.xLocked && ptB.yLocked;
    const aFullyLocked = ptA.xLocked && ptA.yLocked;
    const dir = normalize(subtract({ x: ptB.x, y: ptB.y }, { x: ptA.x, y: ptA.y }));
    if (!bFullyLocked) {
      const newB = add({ x: ptA.x, y: ptA.y }, scale(dir, newLen));
      movePoint(seg.pointBId, newB.x, newB.y);
      await updatePoint(modelId, seg.pointBId, newB.x, newB.y);
    } else if (!aFullyLocked) {
      const newA = subtract({ x: ptB.x, y: ptB.y }, scale(dir, newLen));
      movePoint(seg.pointAId, newA.x, newA.y);
      await updatePoint(modelId, seg.pointAId, newA.x, newA.y);
    }
    setEditingLength(false);
  }

  async function handleSplit() {
    if (!single) return;
    pushHistory();
    const result = await splitSegment(modelId, seg.id);
    if (result) {
      splitSegmentInStore(seg.id, result.newPoint, result.segmentA, result.segmentB);
    }
  }

  async function handleNameChange(name: string) {
    for (const s of segs) {
      storeUpdateSegment(s.id, { name });
      await updateSegment(modelId, s.id, { name });
    }
  }

  const title = single ? "Segment" : `Segments (${segs.length})`;

  const bothLocked = single && ptA && ptB && ptA.xLocked && ptA.yLocked && ptB.xLocked && ptB.yLocked;
  const lengthEditable = single && !bothLocked && lockedVal !== true;
  const angleEditable = single && !bothLocked && angleLocked !== true;

  return (
    <PanelSection title={title}>
      <div className="space-y-2">
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Name</label>
          <input
            key={segmentIds.join(",")}
            defaultValue={nameVal === "mixed" ? "" : nameVal}
            placeholder={nameVal === "mixed" ? "—" : "Unnamed"}
            onBlur={(e) => handleNameChange(e.target.value)}
            className="w-full px-2 py-1 rounded text-xs outline-none"
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
          />
        </div>

        {single && (
          <>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Length</label>
              <div className="flex items-center gap-1.5">
                {editingLength ? (
                  <div
                    className="flex items-center gap-1 flex-1"
                    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) applyLength(); }}
                  >
                    <input
                      autoFocus
                      value={lengthFt}
                      onChange={(e) => setLengthFt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") applyLength(); if (e.key === "Escape") setEditingLength(false); }}
                      className="w-0 flex-1 px-2 py-1 rounded text-xs outline-none"
                      style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--accent)" }}
                    />
                    <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{unit === "standard" ? "ft" : "m"}</span>
                    <input
                      value={lengthIn}
                      onChange={(e) => setLengthIn(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") applyLength(); if (e.key === "Escape") setEditingLength(false); }}
                      className="w-0 flex-1 px-2 py-1 rounded text-xs outline-none"
                      style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--accent)" }}
                    />
                    <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{unit === "standard" ? "in" : "cm"}</span>
                  </div>
                ) : (
                  <button
                    className="flex-1 text-left px-2 py-1 rounded text-xs"
                    style={{
                      background: "var(--surface-2)",
                      color: lengthEditable ? "var(--text)" : "var(--text-muted)",
                      border: "1px solid var(--border)",
                      cursor: lengthEditable ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (lengthEditable && len !== null) {
                        const { primary, secondary } = splitLengthFromFeet(len, unit);
                        setLengthFt(String(primary));
                        setLengthIn(String(secondary));
                        setEditingLength(true);
                      }
                    }}
                  >
                    {len !== null ? formatLength(len, unit) : "—"}
                    {bothLocked && <span className="ml-2 opacity-50">(both locked)</span>}
                  </button>
                )}
                <LockButton locked={lockedVal} onToggle={() => toggleAll("locked")} />
              </div>
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Angle (°)</label>
              <div className="flex items-center gap-1.5">
                {editingAngle ? (
                  <input
                    autoFocus
                    value={angleInput}
                    onChange={(e) => setAngleInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyAngle(); if (e.key === "Escape") setEditingAngle(false); }}
                    onBlur={applyAngle}
                    className="flex-1 px-2 py-1 rounded text-xs outline-none"
                    style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--accent)" }}
                  />
                ) : (
                  <button
                    className="flex-1 text-left px-2 py-1 rounded text-xs"
                    style={{
                      background: "var(--surface-2)",
                      color: angleEditable ? "var(--text)" : "var(--text-muted)",
                      border: "1px solid var(--border)",
                      cursor: angleEditable ? "pointer" : "default",
                    }}
                    onClick={() => { if (angleEditable && angleDeg !== null) { setAngleInput(angleDeg.toFixed(2)); setEditingAngle(true); } }}
                  >
                    {angleDeg !== null ? `${angleDeg.toFixed(2)}°` : "—"}
                    {bothLocked && <span className="ml-2 opacity-50">(both locked)</span>}
                  </button>
                )}
                <LockButton locked={angleLocked} onToggle={() => toggleAll("angleLocked")} />
              </div>
            </div>
          </>
        )}

        {!single && (
          <div className="flex items-center gap-1.5">
            <LockButton locked={lockedVal} onToggle={() => toggleAll("locked")} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {lockedVal === "mixed" ? "Locked (mixed)" : lockedVal ? "Locked" : "Unlocked"}
            </span>
          </div>
        )}

        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Segment type</label>
          <div className="flex gap-1">
            {(["solid", "door", "window"] as const).map((type) => {
              const active = transparentVal !== true && segTypeVal === type;
              const activeColor = type === "window" ? "#3b82f6" : type === "door" ? "#a855f7" : "#6b7280";
              return (
                <button
                  key={type}
                  onClick={() => setAllSegmentType(type)}
                  className="flex-1 py-1 rounded text-xs capitalize"
                  style={{
                    background: active ? activeColor : "var(--surface-2)",
                    color: active ? "#fff" : "var(--text)",
                    border: `1px solid ${active ? activeColor : "var(--border)"}`,
                    opacity: transparentVal !== true && segTypeVal === "mixed" && !active ? 0.6 : 1,
                  }}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              );
            })}
            <button
              onClick={setAllEmpty}
              className="flex-1 py-1 rounded text-xs"
              style={{
                background: transparentVal === true ? "#22c55e" : "var(--surface-2)",
                color: transparentVal === true ? "#fff" : "var(--text)",
                border: `1px solid ${transparentVal === true ? "#22c55e" : "var(--border)"}`,
                opacity: transparentVal === "mixed" ? 0.6 : 1,
              }}
            >
              Empty
            </button>
          </div>
        </div>

        {allDoors && (
          <div className="space-y-2 pl-2" style={{ borderLeft: "2px solid #a855f7" }}>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Hinge side</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setAllDoorHingeSide("left")}
                  className="flex-1 py-1 rounded text-xs"
                  style={{
                    background: doorHingeVal === "left" ? "#a855f7" : "var(--surface-2)",
                    color: doorHingeVal === "left" ? "#fff" : "var(--text)",
                    border: "1px solid var(--border)",
                    opacity: doorHingeVal === "mixed" ? 0.6 : 1,
                  }}
                >
                  ◄ Left
                </button>
                <button
                  onClick={() => setAllDoorHingeSide("right")}
                  className="flex-1 py-1 rounded text-xs"
                  style={{
                    background: doorHingeVal === "right" ? "#a855f7" : "var(--surface-2)",
                    color: doorHingeVal === "right" ? "#fff" : "var(--text)",
                    border: "1px solid var(--border)",
                    opacity: doorHingeVal === "mixed" ? 0.6 : 1,
                  }}
                >
                  Right ►
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Swing direction</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setAllDoorSwingIn(false)}
                  className="flex-1 py-1 rounded text-xs"
                  style={{
                    background: doorSwingVal === false ? "#a855f7" : "var(--surface-2)",
                    color: doorSwingVal === false ? "#fff" : "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Inward
                </button>
                <button
                  onClick={() => setAllDoorSwingIn(true)}
                  className="flex-1 py-1 rounded text-xs"
                  style={{
                    background: doorSwingVal === true ? "#a855f7" : "var(--surface-2)",
                    color: doorSwingVal === true ? "#fff" : "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Outward
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text)" }}>Show dimension</span>
          <MixedToggle value={showDimVal} onToggle={() => toggleAll("showDimensions")} color="var(--accent)" />
        </div>

        {single && (
          <button
            onClick={handleSplit}
            className="w-full py-1.5 rounded text-xs"
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
          >
            Split segment
          </button>
        )}
      </div>
    </PanelSection>
  );
}

function MixedToggle({ value, onToggle, color }: { value: boolean | "mixed"; onToggle: () => void; color: string }) {
  const isOn = value === true;
  const isMixed = value === "mixed";
  return (
    <button
      onClick={onToggle}
      className="w-10 h-5 rounded-full relative transition-colors"
      style={{ background: isOn ? color : isMixed ? "var(--text-muted)" : "var(--border)" }}
      title={isMixed ? "Mixed — click to enable all" : undefined}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full transition-transform flex items-center justify-center"
        style={{
          background: "#fff",
          left: isOn ? "calc(100% - 18px)" : isMixed ? "calc(50% - 8px)" : "2px",
          fontSize: 9,
          color: isMixed ? "var(--text-muted)" : "transparent",
        }}
      >
        {isMixed ? "–" : ""}
      </span>
    </button>
  );
}

function LockButton({ locked, onToggle }: { locked: boolean | "mixed"; onToggle: () => void }) {
  const isLocked = locked === true;
  const isMixed = locked === "mixed";
  return (
    <button
      onClick={onToggle}
      title={isLocked ? "Unlock" : isMixed ? "Mixed — click to lock all" : "Lock"}
      className="shrink-0 p-0.5 rounded"
      style={{ color: isLocked ? "var(--accent)" : "var(--text-muted)", opacity: isMixed ? 0.6 : 1 }}
    >
      {isLocked ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1C9.24 1 7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2h-1V6c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v2H9V6c0-1.66 1.34-3 3-3zm6 7v10H6V10h12zm-6 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      )}
    </button>
  );
}
