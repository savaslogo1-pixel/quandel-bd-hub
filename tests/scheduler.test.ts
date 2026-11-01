import { scheduleBackward } from "../lib/scheduler";
import { latestMeetingOnOrBefore, meetingsInMonth } from "../lib/meetings";

const D = (s: string) => new Date(s + "T00:00:00Z");
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
let fail = 0;
const eq = (a: unknown, b: unknown, m: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.log("FAIL", m, JSON.stringify(a), "≠", JSON.stringify(b)); } else console.log("ok  ", m);
};

// Meeting pattern basics: 2nd and 4th Tuesday of July 2027 → Jul 13, Jul 27.
const tue24 = { weekday: 2, weeks: [2, 4] };
eq(meetingsInMonth(tue24, 2027, 6).map(ymd), ["2027-07-13", "2027-07-27"], "2nd/4th Tuesday July 2027");
eq(meetingsInMonth({ weekday: 1, weeks: [5] }, 2027, 4).map(ymd), ["2027-05-31"], "last Monday May 2027");
eq(ymd(latestMeetingOnOrBefore(tue24, D("2027-07-31"))), "2027-07-27", "latest meeting on or before Jul 31");
eq(ymd(latestMeetingOnOrBefore(tue24, D("2027-07-27"))), "2027-07-27", "meeting on the date itself counts");

// SPEC §12 Phase 4 "done when": a July 31 deadline produces dated steps (NY template).
const ny = [
  { id: "seqr", label: "SEQR determination", needsMeeting: true, waitAfterDays: null },
  { id: "res", label: "Authorizing resolution", needsMeeting: true, waitAfterDays: null },
  { id: "letters", label: "REDC / legislator support letters", needsMeeting: false, waitAfterDays: null },
  { id: "ima", label: "IMA", needsMeeting: true, waitAfterDays: null },
  { id: "bond", label: "Bond resolution (two-thirds vote)", needsMeeting: true, waitAfterDays: 30 },
  { id: "ref", label: "Permissive referendum period ends", needsMeeting: false, waitAfterDays: null },
  { id: "award", label: "Contract award", needsMeeting: true, waitAfterDays: null },
];
const r = scheduleBackward({ steps: ny, deadline: D("2027-07-31"), pattern: tue24, agendaDays: 7, bufferDays: 7, today: D("2026-11-01") });
const got = Object.fromEntries(ny.map((s) => [s.id, ymd(r.dates[s.id].date)]));
// award: latest meeting ≤ Jul 31 = Jul 27
// ref: Jul 27 − 7 = Jul 20
// bond: Jul 20 − 30 = Jun 20 → latest meeting ≤ Jun 20 = Jun 8 (2nd Tue)
// ima: Jun 8 − 7 = Jun 1 → latest meeting ≤ Jun 1 = May 25 (4th Tue)
// letters: May 25 − 7 = May 18
// res: May 18 − 7 = May 11 → May 11 is the 2nd Tuesday → May 11
// seqr: May 11 − 7 = May 4 → Apr 27 (4th Tue)
eq(got, { seqr: "2027-04-27", res: "2027-05-11", letters: "2027-05-18", ima: "2027-05-25", bond: "2027-06-08", ref: "2027-07-20", award: "2027-07-27" }, "NY template back from Jul 31, 2027");
eq(ymd(r.dates.award.agendaDeadline), "2027-07-20", "agenda deadline = meeting − 7 days");
eq(r.dates.letters.agendaDeadline, null, "non-meeting step has no agenda deadline");
eq(r.warnings, [], "no warnings with plenty of lead time");
// every step is on or before the deadline and in order
const seq = ny.map((s) => r.dates[s.id].date.getTime());
eq(seq.every((t, i) => i === 0 || t > seq[i - 1]), true, "steps strictly in order");
eq(r.dates.ref.date.getTime() - r.dates.bond.date.getTime() >= 30 * 86_400_000, true, "referendum wait ≥ 30 days after bond resolution");

// Deadline too close → warning about steps in the past.
const tight = scheduleBackward({ steps: ny, deadline: D("2026-12-15"), pattern: tue24, agendaDays: 7, bufferDays: 7, today: D("2026-11-01") });
eq(tight.warnings.some((w) => w.includes("would need to have happened already")), true, "warns when steps fall in the past");

// No meeting pattern → plain dates and a warning.
const plain = scheduleBackward({ steps: ny.slice(0, 2), deadline: D("2027-07-31"), pattern: { weekday: null, weeks: [] }, agendaDays: null, bufferDays: 10, today: D("2026-11-01") });
eq([ymd(plain.dates.seqr.date), ymd(plain.dates.res.date)], ["2027-07-21", "2027-07-31"], "plain dates with 10-day buffer");
eq(plain.warnings.length, 1, "warns about missing meeting pattern");

if (fail) process.exit(1);
