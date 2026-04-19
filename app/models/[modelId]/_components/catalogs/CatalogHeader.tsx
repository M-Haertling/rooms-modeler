interface Props {
  title: string;
  search: string;
  onSearch: (v: string) => void;
}

export default function CatalogHeader({ title, search, onSearch }: Props) {
  return (
    <div className="px-4 py-3 border-b space-y-2 shrink-0" style={{ borderColor: "var(--border)" }}>
      <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{title}</h2>
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search…"
        className="w-full px-2 py-1 rounded text-xs outline-none"
        style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
      />
    </div>
  );
}
