"use client";

import { useEffect } from "react";
import { useStore } from "@/store";
import Toolbar from "./toolbar/Toolbar";
import CanvasRoot from "./canvas/CanvasRoot";
import SidePanel from "./sidebar/SidePanel";
import CatalogDrawer from "./catalogs/CatalogDrawer";

export default function Editor() {
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [undo, redo]);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <CatalogDrawer />
        <div className="flex-1 relative overflow-hidden">
          <CanvasRoot />
        </div>
        <SidePanel />
      </div>
    </div>
  );
}
