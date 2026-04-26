"use client";

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/store";
import { renameProject } from "@/actions/models";
import UnitSelector from "./UnitSelector";
import ZoomControls from "./ZoomControls";
import AddObjectButton from "./AddObjectButton";
import Link from "next/link";

export default function Toolbar() {
  const projectName = useStore((s) => s.projectName);
  const modelId = useStore((s) => s.modelId);
  const setProjectName = useStore((s) => s.setProjectName);
  const setActiveCatalog = useStore((s) => s.setActiveCatalog);
  const activeCatalog = useStore((s) => s.activeCatalog);
  const canvasBackground = useStore((s) => s.canvasBackground);
  const setCanvasBackground = useStore((s) => s.setCanvasBackground);
  const tapeMeasureMode = useStore((s) => s.tapeMeasureMode);
  const setTapeMeasureMode = useStore((s) => s.setTapeMeasureMode);
  const showPoints = useStore((s) => s.showPoints);
  const setShowPoints = useStore((s) => s.setShowPoints);

  const BG_CYCLE: Array<"dark" | "blueprint" | "light"> = ["dark", "blueprint", "light"];
  const BG_LABELS: Record<string, string> = { dark: "Dark", blueprint: "Blueprint", light: "Light" };
  const cycleBackground = () => {
    const idx = BG_CYCLE.indexOf(canvasBackground);
    setCanvasBackground(BG_CYCLE[(idx + 1) % BG_CYCLE.length]);
  };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(projectName);
      inputRef.current?.select();
    }
  }, [editing, projectName]);

  const save = async () => {
    setEditing(false);
    const trimmed = draft.trim() || projectName;
    setDraft(trimmed);
    if (trimmed !== projectName) {
      setProjectName(trimmed);
      await renameProject(modelId, trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") { setEditing(false); setDraft(projectName); }
  };

  return (
    <header
      className="flex items-center gap-3 px-4 h-12 shrink-0 border-b"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <Link href="/" className="text-sm font-semibold mr-2 hover:opacity-70 transition-opacity" style={{ color: "var(--text)" }}>
        ← Rooms
      </Link>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          className="text-sm px-1 rounded outline-none focus:ring-1"
          style={{
            background: "var(--surface-2)",
            color: "var(--text)",
            border: "1px solid var(--accent)",
            minWidth: 0,
            width: `${Math.max(draft.length, 8)}ch`,
          }}
        />
      ) : (
        <span
          className="text-sm cursor-pointer hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-muted)" }}
          onDoubleClick={() => setEditing(true)}
          title="Double-click to rename"
        >
          {projectName}
        </span>
      )}

      <div className="flex-1" />

      <button
        className="px-3 py-1 text-xs rounded transition-colors"
        style={{
          background: activeCatalog === "layers" ? "var(--accent)" : "var(--surface-2)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        }}
        onClick={() => setActiveCatalog(activeCatalog === "layers" ? null : "layers")}
      >
        Layers
      </button>
      <button
        className="px-3 py-1 text-xs rounded transition-colors"
        style={{
          background: activeCatalog === "objects" ? "var(--accent)" : "var(--surface-2)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        }}
        onClick={() => setActiveCatalog(activeCatalog === "objects" ? null : "objects")}
      >
        Objects
      </button>
      <button
        className="px-3 py-1 text-xs rounded transition-colors"
        style={{
          background: activeCatalog === "templates" ? "var(--accent)" : "var(--surface-2)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        }}
        onClick={() => setActiveCatalog(activeCatalog === "templates" ? null : "templates")}
      >
        Templates
      </button>

      <div className="w-px h-5" style={{ background: "var(--border)" }} />

      <UnitSelector />
      <ZoomControls />
      <button
        onClick={cycleBackground}
        title={`Canvas background: ${BG_LABELS[canvasBackground]} — click to cycle`}
        className="px-2 py-1 text-xs rounded transition-colors"
        style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
      >
        {BG_LABELS[canvasBackground]}
      </button>

      <div className="w-px h-5" style={{ background: "var(--border)" }} />

      <button
        onClick={() => setShowPoints(!showPoints)}
        title={showPoints ? "Hide points" : "Show points"}
        className="px-2 py-1 text-xs rounded transition-colors"
        style={{
          background: showPoints ? "var(--accent)" : "var(--surface-2)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline" }}>
          <circle cx="12" cy="12" r="3" /><circle cx="4" cy="4" r="2" /><circle cx="20" cy="4" r="2" />
          <circle cx="4" cy="20" r="2" /><circle cx="20" cy="20" r="2" />
        </svg>
      </button>
      <button
        onClick={() => setTapeMeasureMode(!tapeMeasureMode)}
        title={tapeMeasureMode ? "Disable tape measure" : "Enable tape measure (or Ctrl+drag)"}
        className="px-2 py-1 text-xs rounded transition-colors"
        style={{
          background: tapeMeasureMode ? "var(--accent)" : "var(--surface-2)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline" }}>
          <path d="M2 12h20M2 12l4-4M2 12l4 4M22 12l-4-4M22 12l-4 4" />
          <line x1="8" y1="9" x2="8" y2="12" /><line x1="12" y1="8" x2="12" y2="12" />
          <line x1="16" y1="9" x2="16" y2="12" />
        </svg>
      </button>

      <div className="w-px h-5" style={{ background: "var(--border)" }} />

      <AddObjectButton />
    </header>
  );
}
