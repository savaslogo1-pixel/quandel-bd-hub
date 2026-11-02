// Bridge list import (SPEC §8: bridge inventory CSV, NBI or county list). Pure.
import { parseBool, parseIntCell, parseMoney, parseYear } from "./orgs";

export type BridgeField = "structureId" | "name" | "county" | "municipality" | "likelyOwner" | "verifiedOwner" | "routeType" | "condition" | "yearBuilt" | "lengthFt" | "widthFt" | "bridgeType" | "adt" | "bundleCandidate" | "status" | "notes" | "contact";

const SYN: Record<BridgeField, string[]> = {
  structureId: ["structure number", "structure id", "nbi structure number", "bridge id", "brkey", "structure"],
  name: ["bridge as published", "bridge", "bridge name", "facility carried", "location", "description", "features"],
  county: ["county"],
  municipality: ["municipality", "township", "place"],
  likelyOwner: ["likely owner from name", "likely owner", "owner"],
  verifiedOwner: ["verified owner"],
  routeType: ["route type from name", "route type", "route"],
  condition: ["condition", "bridge condition", "rating"],
  yearBuilt: ["year built", "built"],
  lengthFt: ["length", "length ft", "structure length", "length feet"],
  widthFt: ["width", "deck width", "width ft"],
  bridgeType: ["type", "bridge type", "structure type", "design"],
  adt: ["vehicles day", "adt", "average daily traffic", "traffic"],
  bundleCandidate: ["bundle candidate y n", "bundle candidate"],
  status: ["status"],
  notes: ["notes"],
  contact: ["contact"],
};
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function guessBridgeMapping(headers: string[]): Partial<Record<BridgeField, number>> {
  const h = headers.map(squash);
  const m: Partial<Record<BridgeField, number>> = {};
  const used = new Set<number>();
  for (const [f, syn] of Object.entries(SYN) as [BridgeField, string[]][]) {
    const i = h.findIndex((x, i) => !used.has(i) && syn.map(squash).includes(x));
    if (i >= 0) { m[f] = i; used.add(i); }
  }
  return m;
}

export type BridgeDraft = {
  structureId: string | null; name: string; county: string; municipality: string | null; ownerName: string | null; ownerVerified: boolean;
  routeType: string | null; condition: string | null; yearBuilt: number | null; lengthFt: number | null; widthFt: number | null;
  bridgeType: string | null; adt: number | null; bundleCandidate: boolean | null; status: string | null; notes: string | null;
};
export type BridgeRow = { line: number; action: "create" | "update" | "skip" | "error"; reason?: string; draft?: BridgeDraft; matchId?: string; key?: string };

/** See Bridge.importKey in the schema. */
export const bridgeKey = (d: Pick<BridgeDraft, "structureId" | "name" | "county" | "yearBuilt" | "adt">, n = 1) =>
  d.structureId ? `nbi:${d.structureId}` : `${squash(d.name)}|${squash(d.county.replace(/\s+county$/i, ""))}|${d.yearBuilt ?? ""}|${d.adt ?? ""}#${n}`;

export function buildBridgePreview(input: { rows: string[][]; headerRow: number; mapping: Partial<Record<BridgeField, number>>; defaults: { condition?: string | null }; existing: { id: string; importKey: string | null }[] }) {
  const cell = (r: string[], f: BridgeField) => (input.mapping[f] != null ? (r[input.mapping[f]!] ?? "").trim() : "");
  const ex = new Map(input.existing.filter((e) => e.importKey).map((e) => [e.importKey!, e.id]));
  const seen = new Map<string, number>();
  const out: BridgeRow[] = input.rows.map((r, i) => {
    const line = input.headerRow + 1 + i;
    const name = cell(r, "name").replace(/\s+/g, " ");
    const county = cell(r, "county").replace(/\s+county$/i, "");
    if (!name && r.filter((c) => c.trim()).length <= 1) return { line, action: "skip", reason: "Note or blank row" };
    if (!name || !county) return { line, action: "error", reason: !name ? "No bridge name" : "No county" };
    const verified = cell(r, "verifiedOwner");
    const likely = cell(r, "likelyOwner");
    const num = (v: number | null | "bad") => (v === "bad" ? null : v);
    const notes = [cell(r, "notes"), cell(r, "contact") && `Contact: ${cell(r, "contact")}`].filter(Boolean).join("\n") || null;
    const bc = parseBool(cell(r, "bundleCandidate"));
    const draft: BridgeDraft = {
      structureId: cell(r, "structureId") || null, name, county, municipality: cell(r, "municipality") || null,
      ownerName: verified || (likely && !/^verify/i.test(likely) ? likely : null) || null, ownerVerified: !!verified,
      routeType: cell(r, "routeType") && !/^verify/i.test(cell(r, "routeType")) ? cell(r, "routeType") : null,
      condition: cell(r, "condition") || input.defaults.condition || null,
      yearBuilt: num(parseYear(cell(r, "yearBuilt"))), lengthFt: num(parseMoney(cell(r, "lengthFt"))), widthFt: num(parseMoney(cell(r, "widthFt"))),
      bridgeType: cell(r, "bridgeType") || null, adt: num(parseIntCell(cell(r, "adt"))), bundleCandidate: bc === "bad" ? null : bc,
      status: cell(r, "status") || null, notes,
    };
    // Identical rows (twin spans) are kept as separate bridges, numbered by position.
    const base = bridgeKey(draft, 0);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const key = bridgeKey(draft, n);
    const id = ex.get(key);
    return id ? { line, action: "update", draft, matchId: id, key } : { line, action: "create", draft, key };
  });
  const counts = { create: 0, update: 0, skip: 0, error: 0 };
  for (const r of out) counts[r.action]++;
  return { rows: out, counts };
}
