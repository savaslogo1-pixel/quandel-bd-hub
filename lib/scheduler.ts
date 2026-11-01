// Backward scheduler (SPEC §4.7, §7): given a deadline and the owner's meeting pattern,
// list the latest date each approval step can happen. Pure function; see tests/scheduler.test.ts.
import { addDays, latestMeetingOnOrBefore, type MeetingPattern } from "./meetings";

export type SchedStep = {
  id: string;
  label: string;
  needsMeeting: boolean;
  /** Days that must pass after this step before the next (from a state rule), or null */
  waitAfterDays: number | null;
};

export type SchedResult = {
  dates: Record<string, { date: Date; agendaDeadline: Date | null }>;
  warnings: string[];
};

/**
 * Walks backward from the last step:
 *  - the last step must happen on or before the deadline;
 *  - each earlier step must happen at least `gap` days before the next one, where gap is the
 *    step's statutory wait (e.g. a 30-day referendum period) or, if none, `bufferDays`
 *    (minimum 1, so steps stay in order);
 *  - steps that need a board meeting land on the latest regular meeting on or before that date;
 *    the agenda deadline is that meeting minus the owner's agenda lead time.
 */
export function scheduleBackward(opts: {
  steps: SchedStep[];
  deadline: Date;
  pattern: MeetingPattern;
  agendaDays: number | null;
  bufferDays: number;
  today: Date;
}): SchedResult {
  const { steps, deadline, pattern, agendaDays, today } = opts;
  const buffer = Math.max(1, Math.round(opts.bufferDays));
  const hasPattern = pattern.weekday != null && pattern.weeks.length > 0;
  const warnings: string[] = [];
  if (!hasPattern && steps.some((s) => s.needsMeeting))
    warnings.push("This owner has no regular meeting pattern on file, so board steps use plain dates. Add it on the organization (e.g., 2nd and 4th Tuesday).");

  const dates: SchedResult["dates"] = {};
  let next: Date | null = null;
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    const gap = s.waitAfterDays != null ? Math.max(1, s.waitAfterDays) : buffer;
    const latest: Date = next == null ? deadline : addDays(next, -gap);
    let date: Date = latest;
    if (s.needsMeeting && hasPattern) {
      const m = latestMeetingOnOrBefore(pattern, latest);
      if (m) date = m;
      else warnings.push(`No regular meeting found before ${latest.toISOString().slice(0, 10)} for "${s.label}".`);
    }
    const agendaDeadline = s.needsMeeting && hasPattern && agendaDays != null ? addDays(date, -agendaDays) : null;
    dates[s.id] = { date, agendaDeadline };
    next = date;
  }
  const first = steps[0] && dates[steps[0].id];
  const past = steps.filter((s) => dates[s.id].date < today || (dates[s.id].agendaDeadline && dates[s.id].agendaDeadline! < today));
  if (past.length)
    warnings.push(`${past.length} step${past.length === 1 ? "" : "s"} (starting with "${past[0].label}") would need to have happened already. The deadline may be too close; consider fewer buffer days or a later deadline.`);
  if (first && !past.length) {
    const lead = Math.round((first.date.getTime() - today.getTime()) / 86_400_000);
    if (lead < 14) warnings.push(`The first step is only ${lead} days away.`);
  }
  return { dates, warnings };
}
