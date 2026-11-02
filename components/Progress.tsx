export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs"><span>{label}</span><span className="mono">{done}/{total}</span></div>
      <div className="h-2 overflow-hidden rounded" style={{ background: "var(--sunken)" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full" style={{ width: `${pct}%`, background: "var(--ok)" }} />
      </div>
    </div>
  );
}

const PART = { done: ["chip-ok", "✓"], todo: ["", "○"], "n/a": ["", "–"] } as const;
export function PartChip({ label, state, title }: { label: string; state: "done" | "todo" | "n/a"; title?: string }) {
  if (state === "n/a") return <span className="chip" style={{ opacity: 0.55 }} title={title}>{label} –</span>;
  return <span className={`chip ${PART[state][0]}`} title={title}>{label} {PART[state][1]}</span>;
}
