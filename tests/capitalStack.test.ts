import { summarize } from "../lib/capitalStack";
import { alertBand } from "../lib/programs";
const prog = (name: string, pct: number | null, basis: any = null, reimb = false) => ({ id: name, name, matchPct: pct, matchBasis: basis, reimbursement: reimb });
const s = summarize([
  { id: "a", label: "Grant A", amount: 1_000_000, status: "APPLIED", reimbursementLagDays: 120, program: prog("Grant A", 50, "PROJECT_COST", true) },
  { id: "b", label: "Grant B", amount: 500_000, status: "IDEA", reimbursementLagDays: null, program: prog("Grant B", 100, "AWARD") },
  { id: "c", label: "Bond", amount: 1_500_000, status: "IDEA", reimbursementLagDays: null, program: null },
  { id: "d", label: "Denied grant", amount: 900_000, status: "DENIED", reimbursementLagDays: null, program: prog("Denied", 25) },
  { id: "e", label: "Grant C", amount: 200_000, status: "IDEA", reimbursementLagDays: null, program: prog("Grant C", null) },
], 4_000_000);
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.log("FAIL", m, a, "≠", b); process.exitCode = 1; } else console.log("ok  ", m); };
eq(s.total, 3_200_000, "total excludes denied");
eq(s.gap, 800_000, "gap = cost − total");
eq(s.matches.map(m => [m.program, m.state]), [["Grant A", "met"], ["Grant B", "met"], ["Grant C", "no_rule"]], "match states");
eq(s.matches[0].required, 2_000_000, "50% of project cost");
eq(s.matches[0].available, 2_200_000, "other sources for A");
eq(s.matches[1].required, 500_000, "100% of award");
eq(s.reimbursement, { amount: 1_000_000, maxLagDays: 120, rows: ["Grant A"] }, "reimbursement cash flow");
const short = summarize([{ id: "a", label: "A", amount: 3_000_000, status: "IDEA", reimbursementLagDays: null, program: prog("A", 50, "PROJECT_COST") }], 4_000_000);
eq([short.matches[0].state, short.matches[0].shortBy], ["short", 2_000_000], "short match");
eq([alertBand(95), alertBand(90), alertBand(61), alertBand(60), alertBand(30), alertBand(15), alertBand(14), alertBand(0), alertBand(-1)], [null, 90, 90, 60, 30, 30, 14, 14, null], "alert bands");
