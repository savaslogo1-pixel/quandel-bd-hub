import { prisma } from "./db";

/** All rules keyed by `key`, with numeric values. */
export async function loadRules(): Promise<Record<string, { value: number | null; text: string; unit: string | null; lastVerifiedAt: Date | null }>> {
  const rows = await prisma.stateRule.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, { value: r.value != null ? Number(r.value) : null, text: r.text, unit: r.unit, lastVerifiedAt: r.lastVerifiedAt }]));
}

const NY_DOWNSTATE = ["nassau", "suffolk", "westchester"];
const NYC = ["new york", "kings", "queens", "bronx", "richmond", "manhattan", "brooklyn", "staten island"];

/**
 * Multiple-prime trigger (SPEC §7): NY Wicks thresholds by region; PA Separations Act value from rules.
 * Returns null when the rule doesn't apply or can't be evaluated.
 */
export function multiPrimeCheck(
  rules: Awaited<ReturnType<typeof loadRules>>,
  org: { state: string; county: string | null },
  value: number | null,
): { applies: boolean | null; threshold: number | null; ruleKey: string; label: string } | null {
  if (org.state === "NY") {
    const c = (org.county ?? "").toLowerCase().replace(/ county$/, "").trim();
    const key = NYC.includes(c) ? "NY.wicks_nyc" : NY_DOWNSTATE.includes(c) ? "NY.wicks_downstate" : "NY.wicks_upstate";
    const label = NYC.includes(c) ? "Wicks (New York City)" : NY_DOWNSTATE.includes(c) ? "Wicks (Nassau/Suffolk/Westchester)" : "Wicks (upstate)";
    const t = rules[key]?.value ?? null;
    return { applies: t == null || value == null ? null : value >= t, threshold: t, ruleKey: key, label: org.county ? label : `${label}; set the county to confirm region` };
  }
  if (org.state === "PA") {
    const t = rules["PA.multiprime_trigger"]?.value ?? null;
    return { applies: t == null || value == null ? null : value >= t, threshold: t, ruleKey: "PA.multiprime_trigger", label: "Separations Act" };
  }
  return null;
}
