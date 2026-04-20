"use client";

import { useState } from "react";
import { useStore } from "@/store";
import { updateSegment, updatePoint, splitSegment } from "@/actions/objects";
import { distance, normalize, add, scale, subtract } from "@/lib/geometry";
import { formatLength, convertFromFeet, convertToFeet, unitLabel } from "@/lib/units";
import PanelSection from "./PanelSection";

interface Props { segmentId: string }

export default function SegmentAttributes({ segmentId }: Props) {
  const seg = useStore((s) => s.segments[segmentId]);
  const ptA = useStore((s) => seg ? s.points[seg.pointAId] : null);
  const ptB = useStore((s) => seg ? s.points[seg.pointBId] : null);
  const unit = useStore((s) => s.unit);
  const modelId = useStore((s) => s.modelId);
  const storeUpdateSegment = useStore((s) => s.updateSegment);
  const movePoint = useStore((s) => s.movePoint);
  const splitSegmentInStore = useStore((s) => s.splitSegmentInStore);
  const pushHistory = useStore((s) => s.pushHistory);

  const [lengthInput, setLengthInput] = useState("");
  const [editingLength, setEditingLength] = useState(false);
  const [angleInput, setAngleInput] = useState("");
  const [editingAngle, setEditingAngle] = useState(false);

  if (!seg || !ptA || !ptB) return null;

  const len = distance({ x: ptA.x, y: ptA.y }, { x: ptB.x, y: ptB.y });
  const angleDeg = (Math.atan2(ptB.y - ptA.y, ptB.x - ptA.x) * 180) / Math.PI;

  async function toggleLocked() {
    storeUpdateSegment(segmentId, { locked: !seg.locked });
    await updateSegment(modelId, segmentId, { locked: !seg.locked });
  }

  async function toggleTransparent() {
    storeUpdateSegment(segmentId, { transparent: !seg.transparent });
    await updateSegment(modelId, segmentId, { transparent: !seg.transparent });
  }

  async function applyAngle() {
    const newAngleDeg = parseFloat(angleInput);
    if (isNaN(newAngleDeg)) return;

    const newAngleRad = (newAngleDeg * Math.PI) / 180;
    const newDir = { x: Math.cos(newAngleRad), y: Math.sin(newAngleRad) };
    if (!ptB!.locked) {
      const newB = add({ x: ptA!.x, y: ptA!.y }, scale(newDir, len));
      movePoint(seg.pointBId, newB.x, newB.y);
      await updatePoint(modelId, seg.pointBId, newB.x, newB.y);
    } else if (!ptA!.locked) {
      const newA = subtract({ x: ptB!.x, y: ptB!.y }, scale(newDir, len));
      movePoint(seg.pointAId, newA.x, newA.y);
      await updatePoint(modelId, seg.pointAId, newA.x, newA.y);
    }
    setEditingAngle(false);
  }

  async function applyLength() {
    const newLen = convertToFeet(parseFloat(lengthInput), unit);
    if (isNaN(newLen) || newLen <= 0) return;

    const dir = normalize(subtract({ x: ptB!.x, y: ptB!.y }, { x: ptA!.x, y: ptA!.y }));
    if (!ptB!.locked) {
      const newB = add({ x: ptA!.x, y: ptA!.y }, scale(dir, newLen));
      movePoint(seg.pointBId, newB.x, newB.y);
      await updatePoint(modelId, seg.pointBId, newB.x, newB.y);
    } else if (!ptA!.locked) {
      const newA = subtract({ x: ptB!.x, y: ptB!.y }, scale(dir, newLen));
      movePoint(seg.pointAId, newA.x, newA.y);
      await updatePoint(modelId, seg.pointAId, newA.x, newA.y);
    }
    setEditingLength(false);
  }

  async function handleSplit() {
    pushHistory();
    const result = await splitSegment(modelId, segmentId);
    if (result) {
      splitSegmentInStore(segmentId, result.newPoint, result.segmentA, result.segmentB);
    }
  }

  async function handleNameChange(name: string) {
    storeUpdateSegment(segmentId, { name });
    await updateSegment(modelId, segmentId, { name });
  }

  return (
    <PanelSection title="Segment">
      <div className="space-y-2">
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Name</label>
          <input
            defaultValue={seg.name ?? ""}
            onBlur={(e) => handleNameChange(e.target.value)}
            className="w-full px-2 py-1 rounded text-xs outline-none"
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
            placeholder="Unnamed"
          />
        </div>

        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Length ({unitLabel(unit)})</label>
          {editingLength ? (
            <div className="flex gap-1">
              <input
                autoFocus
                value={lengthInput}
                onChange={(e) => setLengthInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyLength(); if (e.key === "Escape") setEditingLength(false); }}
                className="flex-1 px-2 py-1 rounded text-xs outline-none"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--accent)" }}
              />
              <button onClick={applyLength} className="px-2 py-1 rounded text-xs" style={{ background: "var(--accent)", color: "#fff" }}>✓</button>
            </div>
          ) : (
            <button
              className="w-full text-left px-2 py-1 rounded text-xs"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              onClick={() => { setLengthInput(convertFromFeet(len, unit).toFixed(1)); setEditingLength(true); }}
              disabled={ptA.locked && ptB.locked}
            >
              {formatLength(len, unit)}
              {ptA.locked && ptB.locked && <span className="ml-2 opacity-50">(both locked)</span>}
            </button>
          )}
        </div>

        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Angle (°)</label>
          {editingAngle ? (
            <div className="flex gap-1">
              <input
                autoFocus
                value={angleInput}
                onChange={(e) => setAngleInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyAngle(); if (e.key === "Escape") setEditingAngle(false); }}
                className="flex-1 px-2 py-1 rounded text-xs outline-none"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--accent)" }}
              />
              <button onClick={applyAngle} className="px-2 py-1 rounded text-xs" style={{ background: "var(--accent)", color: "#fff" }}>✓</button>
            </div>
          ) : (
            <button
              className="w-full text-left px-2 py-1 rounded text-xs"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              onClick={() => { setAngleInput(angleDeg.toFixed(2)); setEditingAngle(true); }}
              disabled={ptA.locked && ptB.locked}
            >
              {angleDeg.toFixed(2)}°
              {ptA.locked && ptB.locked && <span className="ml-2 opacity-50">(both locked)</span>}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text)" }}>Locked length</span>
          <button
            onClick={toggleLocked}
            className="w-10 h-5 rounded-full relative transition-colors"
            style={{ background: seg.locked ? "var(--accent)" : "var(--border)" }}
          >
            <span className="absolute top-0.5 w-4 h-4 rounded-full transition-transform" style={{ background: "#fff", left: seg.locked ? "calc(100% - 18px)" : "2px" }} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text)" }}>Transparent (door/opening)</span>
          <button
            onClick={toggleTransparent}
            className="w-10 h-5 rounded-full relative transition-colors"
            style={{ background: seg.transparent ? "#22c55e" : "var(--border)" }}
          >
            <span className="absolute top-0.5 w-4 h-4 rounded-full transition-transform" style={{ background: "#fff", left: seg.transparent ? "calc(100% - 18px)" : "2px" }} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text)" }}>Show dimension</span>
          <button
            onClick={async () => {
              storeUpdateSegment(segmentId, { showDimensions: !seg.showDimensions });
              await updateSegment(modelId, segmentId, { showDimensions: !seg.showDimensions });
            }}
            className="w-10 h-5 rounded-full relative transition-colors"
            style={{ background: seg.showDimensions ? "var(--accent)" : "var(--border)" }}
          >
            <span className="absolute top-0.5 w-4 h-4 rounded-full transition-transform" style={{ background: "#fff", left: seg.showDimensions ? "calc(100% - 18px)" : "2px" }} />
          </button>
        </div>

        <button
          onClick={handleSplit}
          className="w-full py-1.5 rounded text-xs"
          style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
        >
          Split segment
        </button>
      </div>
    </PanelSection>
  );
}
