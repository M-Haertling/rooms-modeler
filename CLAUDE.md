# Overview

A room modeling and virtual furnishing app. Users create 2D polygon/ellipse objects representing furniture and architectural elements, organize them into layers, and model full room layouts. Each model is stored as its own SQLite `.db` file.

# Technology

- **Next.js 15** (App Router, TypeScript, Tailwind CSS v4)
- **`node:sqlite`** — Node.js 24 built-in SQLite (no native compilation required; replaces `better-sqlite3`)
- **Zustand + immer** — client-side state with snapshot-based undo/redo
- **Radix UI** — accessible UI primitives (Dialog, Tooltip, Select, etc.)
- All DB access via **Next.js Server Actions** (no separate API layer except the assets file-serving route)

# Architecture

## Multi-model
Each model is a separate `.db` file stored in `~/rooms-models/` (override with `ROOMS_MODELS_DIR` env var). The home page lists all `.db` files in that directory. Opening a model connects to its file and auto-runs the schema on first open (`db/schema.sql`).

## Key directories
```
db/             schema.sql + client.ts (singleton DB connection per file path)
actions/        Server Actions: models, objects, layers, templates, types, images
store/          Zustand store (index.ts) — single file with all slices
lib/            geometry.ts, units.ts, lasso.ts, normalize.ts, cn.ts
types/          canvas.ts — all shared TypeScript types
app/
  page.tsx                        Home: list/create models
  models/[modelId]/
    page.tsx                      Load project data, hydrate store, render editor
    _components/
      EditorShell.tsx             Client boundary — hydrates Zustand on mount
      Editor.tsx                  Layout shell + keyboard shortcuts (Ctrl+Z/Y)
      canvas/                     SVG canvas components
      toolbar/                    Toolbar, UnitSelector, ZoomControls, AddObjectButton
      sidebar/                    SidePanel, PointAttributes, SegmentAttributes, ObjectAttributes
      catalogs/                   CatalogDrawer, ObjectCatalog, TemplateCatalog, LayerCatalog
  api/models/[modelId]/assets/    File-serving route for object images
```

## Coordinate system
Canvas uses **real-world units** (feet by default). `zoom` = pixels per unit (default 50). Points are stored and displayed in world units. Pan/zoom implemented as `<g transform="translate(panX,panY) scale(zoom)">` inside the SVG. Screen → world: `(svgPoint - panOffset) / zoom`.

## Data model (SQLite tables)
`project` · `object_types` · `layers` (self-referential parent_id) · `objects` · `points` · `segments` · `object_images` · `templates`

Points store coordinates in world units. `sort_order` uses fractional values to support segment splits without renumbering. Segments are stored explicitly (not derived) to attach name and lock state.

## State persistence
Zustand is the UI source of truth. Every mutation fires a server action (fire-and-forget) to persist to SQLite. On page load, the server component fetches everything and passes it to `EditorShell` which hydrates the store via `useEffect`. Undo/redo is in-memory only (not persisted).

# Running

```bash
npm run dev     # start dev server at http://localhost:3000
```

The `node:sqlite` experimental warning from Node 24 is cosmetic — ignore it.

# Notes

- Do not use `better-sqlite3` — it requires Visual Studio Build Tools to compile on Windows. Use `node:sqlite` from Node.js 24.
- Server Actions must `import "server-only"` or be in `actions/` — never import DB client code from client components.
- The `nanoid` import uses ESM; if adding new scripts, use `.mjs` extension or configure `tsx`.
