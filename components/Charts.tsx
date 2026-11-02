// Small server-rendered charts. Per the data-viz method: thin bars with 4px rounded data ends
// anchored at the baseline, a 2px surface gap between segments, direct value labels in text ink
// (never the series color), a legend whenever there are 2+ series, a title tooltip on every mark,
// and a table view alongside on the page.

export type Bar = { key: string; label: string; value: number; color: string; display: string; title?: string };

/** One horizontal bar per row; value labels sit just past the bar end. */
export function HBars({ rows, max, ariaLabel }: { rows: Bar[]; max?: number; ariaLabel: string }) {
  const top = Math.max(max ?? 0, ...rows.map((r) => r.value), 1);
  return (
    <div role="img" aria-label={ariaLabel} className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[minmax(80px,140px)_1fr] items-center gap-2 text-[13px]">
          <span className="truncate" title={r.label}>{r.label}</span>
          <div className="flex items-center gap-2" style={{ borderLeft: "1px solid var(--axis)" }}>
            <div
              title={r.title ?? `${r.label}: ${r.display}`}
              style={{ width: `${(r.value / top) * 100}%`, minWidth: r.value > 0 ? 3 : 0, height: 14, background: r.color, borderRadius: "0 4px 4px 0" }}
            />
            <span className="mono shrink-0 text-xs" style={{ color: "var(--ink)" }}>{r.display}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export type Segment = { key: string; value: number; color: string; title: string };

/** Stacked horizontal bars (rows × ordered segments) with a total label and a legend. */
export function StackedHBars({ rows, legend, ariaLabel }: { rows: { key: string; label: string; total: string; segments: Segment[] }[]; legend: { label: string; color: string }[]; ariaLabel: string }) {
  const top = Math.max(1, ...rows.map((r) => r.segments.reduce((a, s) => a + s.value, 0)));
  return (
    <div>
      <div role="img" aria-label={ariaLabel} className="flex flex-col gap-1.5">
        {rows.map((r) => {
          const segs = r.segments.filter((s) => s.value > 0);
          return (
            <div key={r.key} className="grid grid-cols-[minmax(80px,140px)_1fr] items-center gap-2 text-[13px]">
              <span className="truncate">{r.label}</span>
              <div className="flex items-center gap-2" style={{ borderLeft: "1px solid var(--axis)" }}>
                <div className="flex" style={{ width: `${(segs.reduce((a, s) => a + s.value, 0) / top) * 100}%`, gap: 2 }}>
                  {segs.map((s, i) => (
                    <div key={s.key} title={s.title} style={{ flexGrow: s.value, flexBasis: 0, minWidth: 3, height: 14, background: s.color, borderRadius: i === segs.length - 1 ? "0 4px 4px 0" : 0 }} />
                  ))}
                </div>
                <span className="mono shrink-0 text-xs">{r.total}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--muted)" }}>
        {legend.map((l) => <span key={l.label} className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />{l.label}</span>)}
      </div>
    </div>
  );
}

export function Stat({ value, label, note, href, tone }: { value: string; label: string; note?: string; href?: string; tone?: "bad" | "warn" }) {
  const body = (
    <>
      <b className="block text-[26px] font-semibold leading-tight" style={tone ? { color: `var(--${tone})` } : undefined}>{value}</b>
      <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>{label}</span>
      {note && <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>{note}</span>}
    </>
  );
  const style = tone ? { borderColor: `var(--${tone})` } : undefined;
  return href ? <a href={href} className="panel block no-underline" style={{ ...style, color: "var(--ink)" }}>{body}</a> : <div className="panel" style={style}>{body}</div>;
}

/**
 * Open pipeline in four phases on an ordinal blue ramp (light = early, dark = late).
 * Eight single stages are too close to tell apart, so stages are grouped; validated with
 * --ordinal on both surfaces (monotone, adjacent ΔL ≥ 0.06, ends ≥ 2:1).
 */
export const PHASES = [
  { key: "early", label: "Target · Engaged (1–2)", stages: [1, 2], color: "#86b6ef" },
  { key: "shape", label: "Need · Funding path (3–4)", stages: [3, 4], color: "#5598e7" },
  { key: "pre", label: "Pre-procurement (5)", stages: [5], color: "#2a78d6" },
  { key: "pursuit", label: "Pursuit · Submitted · Shortlist (6–8)", stages: [6, 7, 8], color: "#1c5cab" },
];
export const companyColor = (code: string) => `var(--c-${code.toLowerCase()})`;
