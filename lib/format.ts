const DAY = 86_400_000;

/** Calendar date from a stored DateTime, ignoring time zone shifts. */
export function ymd(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function fmtDate(d: Date | null | undefined, opts: { year?: boolean } = {}): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: opts.year === false ? undefined : "numeric",
    timeZone: "UTC",
  });
}

/** Today as a UTC-midnight Date, matching how date-only fields are stored. */
export function todayUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

export function daysFromToday(d: Date): number {
  return Math.round((d.getTime() - todayUTC().getTime()) / DAY);
}

export function money(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function num(v: unknown): string {
  if (v == null || v === "") return "—";
  return Number(v).toLocaleString("en-US");
}
