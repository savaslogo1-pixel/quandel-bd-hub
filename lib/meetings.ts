import { WEEKDAYS, WEEK_LABELS } from "./constants";

export type MeetingPattern = { weekday: number | null; weeks: number[] };

export function parsePattern(weekday: number | null | undefined, weeks: string | null | undefined): MeetingPattern {
  return {
    weekday: weekday ?? null,
    weeks: (weeks ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => n >= 1 && n <= 5),
  };
}

export function patternText(p: MeetingPattern): string {
  if (p.weekday == null || !p.weeks.length) return "";
  return [...p.weeks].sort().map((w) => WEEK_LABELS[w]).join(" and ") + " " + WEEKDAYS[p.weekday];
}

/** Meeting dates (UTC midnight) in a given month for a pattern like "2nd and 4th Tuesday". */
export function meetingsInMonth(p: MeetingPattern, year: number, month: number): Date[] {
  if (p.weekday == null || !p.weeks.length) return [];
  const days: number[] = [];
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let d = 1 + ((p.weekday - first + 7) % 7); d <= last; d += 7) days.push(d);
  const out = new Set<number>();
  for (const w of p.weeks) {
    const d = w === 5 ? days[days.length - 1] : days[w - 1];
    if (d) out.add(d);
  }
  return [...out].sort((a, b) => a - b).map((d) => new Date(Date.UTC(year, month, d)));
}

/** All meetings from `from` through `to` inclusive. */
export function meetingsBetween(p: MeetingPattern, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  while (Date.UTC(y, m, 1) <= to.getTime()) {
    out.push(...meetingsInMonth(p, y, m));
    m++;
    if (m === 12) { m = 0; y++; }
  }
  return out.filter((d) => d >= from && d <= to);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
