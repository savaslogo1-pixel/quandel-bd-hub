// Bridge bundle estimate (SPEC §4.11). Pure; see tests/bridges.test.ts.

export type BundleBridgeIn = { id: string; name: string; county: string; bridgeType: string | null; estimate: number | null; lengthFt: number | null; widthFt: number | null };

/**
 * Each bridge uses its own estimate when entered; otherwise deck area × the bundle's unit cost
 * when length, width and unit cost are all known. Soft costs and contingency are percentages of
 * construction. Bridges with no basis for an estimate are counted as missing.
 */
export function bundleEstimate(bridges: BundleBridgeIn[], opts: { unitCostPerSqFt: number | null; designPct: number | null; cmPct: number | null; contingencyPct: number | null }) {
  const lines = bridges.map((b) => {
    if (b.estimate != null) return { ...b, cost: b.estimate, basis: "estimate" as const };
    if (b.lengthFt != null && b.widthFt != null && opts.unitCostPerSqFt != null)
      return { ...b, cost: b.lengthFt * b.widthFt * opts.unitCostPerSqFt, basis: "area" as const };
    return { ...b, cost: null, basis: "missing" as const };
  });
  const construction = lines.reduce((a, l) => a + (l.cost ?? 0), 0);
  const design = construction * ((opts.designPct ?? 0) / 100);
  const cm = construction * ((opts.cmPct ?? 0) / 100);
  const contingency = construction * ((opts.contingencyPct ?? 0) / 100);
  const groups = new Map<string, { type: string; county: string; count: number; cost: number; missing: number }>();
  for (const l of lines) {
    const type = l.bridgeType || "Type not set";
    const k = `${type}|${l.county}`;
    const g = groups.get(k) ?? { type, county: l.county, count: 0, cost: 0, missing: 0 };
    g.count++;
    g.cost += l.cost ?? 0;
    if (l.cost == null) g.missing++;
    groups.set(k, g);
  }
  const missing = lines.filter((l) => l.cost == null).length;
  return {
    lines, construction, design, cm, contingency, total: construction + design + cm + contingency,
    missing, complete: bridges.length > 0 && missing === 0,
    groups: [...groups.values()].sort((a, b) => a.type.localeCompare(b.type) || a.county.localeCompare(b.county)),
  };
}
