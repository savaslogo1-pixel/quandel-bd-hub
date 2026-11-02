// Compliance rules (SPEC §4.14). Thresholds come from State rules by key; pure helpers are tested.

export type ThresholdState = "ok" | "near" | "over" | "unknown";

/** Lobbying spend vs a registration threshold: near at 80%, over at 100%; no threshold → unknown. */
export function lobbyingStatus(total: number, threshold: number | null): { state: ThresholdState; pct: number | null } {
  if (threshold == null || threshold <= 0) return { state: "unknown", pct: null };
  const pct = (total / threshold) * 100;
  return { state: pct >= 100 ? "over" : pct >= 80 ? "near" : "ok", pct };
}

/** A gift breaks the jurisdiction's limit when a numeric limit exists and the value is above it. */
export function giftOverLimit(value: number, limit: number | null): boolean | null {
  if (limit == null) return null;
  return value > limit;
}

export const giftLimitKey = (state: string) => `${state}.gift_limit`;
export const lobbyingKey = (state: string) => `${state}.lobbying_threshold`;

export const GIFT_KINDS = ["gift", "meal", "event", "travel", "other"];
