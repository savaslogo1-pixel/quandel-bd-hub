// Capital stack math (SPEC §4.6). Pure functions so the rules are easy to read and test.
import type { MatchBasis, StackStatus } from "@prisma/client";

export type StackRowInput = {
  id: string;
  amount: number | null;
  status: StackStatus;
  reimbursementLagDays: number | null;
  program: { id: string; name: string; matchPct: number | null; matchBasis: MatchBasis | null; reimbursement: boolean | null } | null;
  label: string;
};

export type MatchCheck = {
  rowId: string;
  program: string;
  state: "met" | "short" | "no_rule";
  required?: number;
  available?: number;
  shortBy?: number;
  pct?: number;
  basis?: MatchBasis;
};

export type StackSummary = {
  projectCost: number | null;
  total: number; // every source except denied ones
  committed: number; // awarded + closed
  gap: number | null; // project cost − total (negative = over-funded)
  byStatus: Record<StackStatus, number>;
  matches: MatchCheck[];
  reimbursement: { amount: number; maxLagDays: number; rows: string[] };
};

const amt = (r: StackRowInput) => r.amount ?? 0;
const counts = (r: StackRowInput) => r.status !== "DENIED";

/**
 * Match rule: the other (non-denied) sources in the stack must cover matchPct of the basis.
 *   PROJECT_COST basis → pct × project cost;  AWARD basis → pct × this row's amount.
 * Programs with no match % in the library show "no rule" ([confirm] in the library).
 * Programs that restrict which funds count as match (e.g. "non-state funds") need a
 * person to check the sources; the note on the program says so.
 */
export function summarize(rows: StackRowInput[], projectCost: number | null): StackSummary {
  const byStatus = { IDEA: 0, APPLIED: 0, AWARDED: 0, DENIED: 0, CLOSED: 0 } as Record<StackStatus, number>;
  for (const r of rows) byStatus[r.status] += amt(r);
  const total = rows.filter(counts).reduce((a, r) => a + amt(r), 0);
  const committed = byStatus.AWARDED + byStatus.CLOSED;

  const matches: MatchCheck[] = rows
    .filter((r) => r.program && counts(r))
    .map((r) => {
      const p = r.program!;
      if (p.matchPct == null) return { rowId: r.id, program: p.name, state: "no_rule" as const };
      const basis = p.matchBasis ?? "PROJECT_COST";
      const base = basis === "AWARD" ? amt(r) : projectCost ?? 0;
      const required = (p.matchPct / 100) * base;
      const available = total - amt(r);
      return {
        rowId: r.id, program: p.name, pct: p.matchPct, basis, required, available,
        state: available >= required ? ("met" as const) : ("short" as const),
        shortBy: Math.max(0, required - available),
      };
    });

  const reimb = rows.filter((r) => counts(r) && r.program?.reimbursement && r.status !== "CLOSED");
  return {
    projectCost,
    total,
    committed,
    gap: projectCost == null ? null : projectCost - total,
    byStatus,
    matches,
    reimbursement: {
      amount: reimb.reduce((a, r) => a + amt(r), 0),
      maxLagDays: reimb.reduce((a, r) => Math.max(a, r.reimbursementLagDays ?? 0), 0),
      rows: reimb.map((r) => r.label),
    },
  };
}
