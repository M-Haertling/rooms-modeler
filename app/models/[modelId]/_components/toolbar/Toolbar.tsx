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

      <div className="w-px h-5" style={{ background: "var(--border)" }} />

      <AddObjectButton />
    </header>
  );
}
