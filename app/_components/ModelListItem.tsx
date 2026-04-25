"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { renameProject } from "@/actions/models";

interface Props {
  id: string;
  name: string;
  updatedAt: number;
}

export default function ModelListItem({ id, name, updatedAt }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [displayName, setDisplayName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(displayName);
      inputRef.current?.select();
    }
  }, [editing, displayName]);

  const save = async () => {
    setEditing(false);
    const trimmed = draft.trim() || displayName;
    setDraft(trimmed);
    if (trimmed !== displayName) {
      setDisplayName(trimmed);
      await renameProject(id, trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") { setEditing(false); setDraft(displayName); }
  };

  return (
    <li className="flex items-center gap-2">
      <Link
        href={`/models/${id}`}
        className="flex-1 flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:border-[var(--accent)]"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.preventDefault()}
            className="font-medium text-sm px-1 rounded outline-none focus:ring-1 flex-1"
            style={{
              background: "var(--surface-2)",
              color: "var(--text)",
              border: "1px solid var(--accent)",
              minWidth: 0,
            }}
          />
        ) : (
          <span className="font-medium text-sm">{displayName}</span>
        )}
        <span className="text-xs ml-4 shrink-0" style={{ color: "var(--text-muted)" }}>
          {new Date(updatedAt).toLocaleDateString()}
        </span>
      </Link>
      <button
        onClick={() => setEditing(true)}
        className="p-2 rounded transition-colors hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
        title="Rename"
      >
        ✎
      </button>
    </li>
  );
}
