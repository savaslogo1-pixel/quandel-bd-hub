import type { MatchBasis, OtherSource, ProgramType, StackStatus } from "@prisma/client";
import { todayUTC } from "./format";

export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  GRANT: "Grant", LOAN: "Loan", TAX_CREDIT: "Tax credit", FORMULA_AID: "Formula aid", REBATE: "Rebate", ELECTIVE_PAY: "Elective pay",
};
export const MATCH_BASIS_LABELS: Record<MatchBasis, string> = { PROJECT_COST: "of project cost", AWARD: "of the award" };
export const STACK_STATUS_LABELS: Record<StackStatus, string> = { IDEA: "Idea", APPLIED: "Applied", AWARDED: "Awarded", DENIED: "Denied", CLOSED: "Closed" };
export const STACK_STATUSES = Object.keys(STACK_STATUS_LABELS) as StackStatus[];
export const OTHER_SOURCE_LABELS: Record<OtherSource, string> = {
  BOND: "Bond", NOTE: "Note", CAPITAL_RESERVE: "Capital reserve", GESA_FINANCING: "GESA financing",
  PRIVATE_EQUITY: "Private equity", OWNER_CASH: "Owner cash", OTHER: "Other",
};
export const JURISDICTIONS = ["PA", "NY", "MD", "NJ", "DE", "OH", "WV", "VA", "DC", "Federal"];

/** SPEC §7: show a yellow badge when a record was never verified or is more than 12 months old. */
export function verification(d: Date | null | undefined): "never" | "stale" | "current" {
  if (!d) return "never";
  const yearAgo = new Date(todayUTC());
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
  return d < yearAgo ? "stale" : "current";
}

/** Deadline alert bands (SPEC §4.5): 90, 60, 30 and 14 days before next_deadline. */
export const ALERT_BANDS = [90, 60, 30, 14] as const;
export function alertBand(daysLeft: number): (typeof ALERT_BANDS)[number] | null {
  if (daysLeft < 0) return null;
  for (const b of [...ALERT_BANDS].reverse()) if (daysLeft <= b) return b;
  return null;
}
