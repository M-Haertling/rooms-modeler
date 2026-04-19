"use client";

import { useStore } from "@/store";
import UnitSelector from "./UnitSelector";
import ZoomControls from "./ZoomControls";
import AddObjectButton from "./AddObjectButton";
import Link from "next/link";

export default function Toolbar() {
  const projectName = useStore((s) => s.projectName);
  const setActiveCatalog = useStore((s) => s.setActiveCatalog);
  const activeCatalog = useStore((s) => s.activeCatalog);

  return (
    <header
      className="flex items-center gap-3 px-4 h-12 shrink-0 border-b"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <Link href="/" className="text-sm font-semibold mr-2 hover:opacity-70 transition-opacity" style={{ color: "var(--text)" }}>
        ← Rooms
      </Link>
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>{projectName}</span>

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
