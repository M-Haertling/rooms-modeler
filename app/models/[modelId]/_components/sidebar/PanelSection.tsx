interface Props {
  title: string;
  children: React.ReactNode;
}

export default function PanelSection({ title, children }: Props) {
  return (
    <div className="border-b px-4 py-3 space-y-3" style={{ borderColor: "var(--border)" }}>
      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
