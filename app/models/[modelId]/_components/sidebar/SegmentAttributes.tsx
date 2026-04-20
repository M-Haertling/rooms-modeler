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

  async function toggleAngleLocked() {
    storeUpdateSegment(segmentId, { angleLocked: !seg.angleLocked });
    await updateSegment(modelId, segmentId, { angleLocked: !seg.angleLocked });
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
    const bFullyLocked = ptB!.xLocked && ptB!.yLocked;
    const aFullyLocked = ptA!.xLocked && ptA!.yLocked;
    if (!bFullyLocked) {
      const newB = add({ x: ptA!.x, y: ptA!.y }, scale(newDir, len));
      movePoint(seg.pointBId, newB.x, newB.y);
      await updatePoint(modelId, seg.pointBId, newB.x, newB.y);
    } else if (!aFullyLocked) {
      const newA = subtract({ x: ptB!.x, y: ptB!.y }, scale(newDir, len));
      movePoint(seg.pointAId, newA.x, newA.y);
      await updatePoint(modelId, seg.pointAId, newA.x, newA.y);
    }
    setEditingAngle(false);
  }

  async function applyLength() {
    const newLen = convertToFeet(parseFloat(lengthInput), unit);
    if (isNaN(newLen) || newLen <= 0) return;

    const bFullyLocked = ptB!.xLocked && ptB!.yLocked;
    const aFullyLocked = ptA!.xLocked && ptA!.yLocked;
    const dir = normalize(subtract({ x: ptB!.x, y: ptB!.y }, { x: ptA!.x, y: ptA!.y }));
    if (!bFullyLocked) {
      const newB = add({ x: ptA!.x, y: ptA!.y }, scale(dir, newLen));
      movePoint(seg.pointBId, newB.x, newB.y);
      await updatePoint(modelId, seg.pointBId, newB.x, newB.y);
    } else if (!aFullyLocked) {
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

  async function toggleDoor() {
    storeUpdateSegment(segmentId, { door: !seg.door });
    await updateSegment(modelId, segmentId, { door: !seg.door });
  }

  async function setDoorSwingIn(value: boolean) {
    storeUpdateSegment(segmentId, { doorSwingIn: value });
    await updateSegment(modelId, segmentId, { doorSwingIn: value });
  }

  async function setDoorHingeSide(value: "left" | "right") {
    storeUpdateSegment(segmentId, { doorHingeSide: value });
    await updateSegment(modelId, segmentId, { doorHingeSide: value });
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
          <div className="flex items-center gap-1.5">
            {editingLength ? (
              <input
                autoFocus
                value={lengthInput}
                onChange={(e) => setLengthInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyLength(); if (e.key === "Escape") setEditingLength(false); }}
                onBlur={applyLength}
                className="flex-1 px-2 py-1 rounded text-xs outline-none"
                style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--accent)" }}
              />
            ) : (
              <button
                className="flex-1 text-left px-2 py-1 rounded text-xs"
                style={{
                  background: "var(--surface-2)",
                  color: (ptA.xLocked && ptA.yLocked && ptB.xLocked && ptB.yLocked) || seg.locked ? "var(--text-muted)" : "var(--text)",
                  border: "1px solid var(--border)",
                  cursor: (ptA.xLocked && ptA.yLocked && ptB.xLocked && ptB.yLocked) || seg.locked ? "default" : "pointer",
                }}
                onClick={() => { if (!(ptA.xLocked && ptA.yLocked && ptB.xLocked && ptB.yLocked) && !seg.locked) { setLengthInput(convertFromFeet(len, unit).toFixed(1)); setEditingLength(true); } }}
              >
                {formatLength(len, unit)}
                {ptA.xLocked && ptA.yLocked && ptB.xLocked && ptB.yLocked && <span className="ml-2 opacity-50">(both locked)</span>}
              </button>
            )}
            <LockButton locked={seg.locked} onToggle={toggleLocked} />
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
                  color: (ptA.xLocked && ptA.yLocked && ptB.xLocked && ptB.yLocked) || seg.angleLocked ? "var(--text-muted)" : "var(--text)",
                  border: "1px solid var(--border)",
                  cursor: (ptA.xLocked && ptA.yLocked && ptB.xLocked && ptB.yLocked) || seg.angleLocked ? "default" : "pointer",
                }}
                onClick={() => { if (!(ptA.xLocked && ptA.yLocked && ptB.xLocked && ptB.yLocked) && !seg.angleLocked) { setAngleInput(angleDeg.toFixed(2)); setEditingAngle(true); } }}
              >
                {angleDeg.toFixed(2)}°
                {ptA.xLocked && ptA.yLocked && ptB.xLocked && ptB.yLocked && <span className="ml-2 opacity-50">(both locked)</span>}
              </button>
            )}
            <LockButton locked={seg.angleLocked} onToggle={toggleAngleLocked} />
          </div>
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
          <span className="text-xs" style={{ color: "var(--text)" }}>Door</span>
          <button
            onClick={toggleDoor}
            className="w-10 h-5 rounded-full relative transition-colors"
            style={{ background: seg.door ? "#a855f7" : "var(--border)" }}
          >
            <span className="absolute top-0.5 w-4 h-4 rounded-full transition-transform" style={{ background: "#fff", left: seg.door ? "calc(100% - 18px)" : "2px" }} />
          </button>
        </div>

        {seg.door && (
          <div className="space-y-2 pl-2" style={{ borderLeft: "2px solid #a855f7" }}>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Hinge side</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setDoorHingeSide("left")}
                  className="flex-1 py-1 rounded text-xs"
                  style={{
                    background: seg.doorHingeSide === "left" ? "#a855f7" : "var(--surface-2)",
                    color: seg.doorHingeSide === "left" ? "#fff" : "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                >
                  ◄ Left
                </button>
                <button
                  onClick={() => setDoorHingeSide("right")}
                  className="flex-1 py-1 rounded text-xs"
                  style={{
                    background: seg.doorHingeSide === "right" ? "#a855f7" : "var(--surface-2)",
                    color: seg.doorHingeSide === "right" ? "#fff" : "var(--text)",
                    border: "1px solid var(--border)",
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
                  onClick={() => setDoorSwingIn(false)}
                  className="flex-1 py-1 rounded text-xs"
                  style={{
                    background: !seg.doorSwingIn ? "#a855f7" : "var(--surface-2)",
                    color: !seg.doorSwingIn ? "#fff" : "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Inward
                </button>
                <button
                  onClick={() => setDoorSwingIn(true)}
                  className="flex-1 py-1 rounded text-xs"
                  style={{
                    background: seg.doorSwingIn ? "#a855f7" : "var(--surface-2)",
                    color: seg.doorSwingIn ? "#fff" : "var(--text)",
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

function LockButton({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={locked ? "Unlock" : "Lock"}
      className="shrink-0 p-0.5 rounded"
      style={{ color: locked ? "var(--accent)" : "var(--text-muted)" }}
    >
      {locked ? (
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
