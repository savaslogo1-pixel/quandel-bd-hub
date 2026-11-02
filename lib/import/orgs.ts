// Organization import rules (SPEC §8): map columns, normalize values, de-duplicate on
// name + state + type, and build a preview before anything is written. Pure functions.
import type { OrgStatus, StateCode, Tier } from "@prisma/client";

export type FieldKind = "text" | "int" | "money" | "year" | "age" | "state" | "orgType" | "tier" | "status" | "companies" | "url" | "bool" | "esco";
export type FieldDef = { key: string; label: string; kind: FieldKind; synonyms: string[]; required?: boolean };

export const ORG_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", kind: "text", required: true, synonyms: ["name", "organization", "organization name", "org name", "owner", "owner name", "entity", "entity name", "municipality", "municipality name", "school district", "district", "district name", "lea", "lea name", "local government", "government", "government name", "unit name", "school entity", "aun name", "client", "target", "account"] },
  { key: "orgType", label: "Organization type", kind: "orgType", synonyms: ["type", "org type", "organization type", "entity type", "owner type", "class", "municipality type", "municipal type", "government type", "category", "class of municipality", "lea type", "sector"] },
  { key: "state", label: "State", kind: "state", synonyms: ["state", "st", "state code"] },
  { key: "county", label: "County", kind: "text", synonyms: ["county", "county name"] },
  { key: "region", label: "Region", kind: "text", synonyms: ["region", "redc", "redc region", "area", "territory", "iu region"] },
  { key: "address", label: "Address", kind: "text", synonyms: ["address", "street", "mailing address", "street address"] },
  { key: "website", label: "Website", kind: "url", synonyms: ["website", "url", "web", "web site", "homepage"] },
  { key: "tier", label: "Tier", kind: "tier", synonyms: ["tier", "priority", "target tier"] },
  { key: "status", label: "Status", kind: "status", synonyms: ["status", "account status"] },
  { key: "companies", label: "Company tags", kind: "companies", synonyms: ["company", "companies", "company tag", "quandel company", "business unit"] },
  { key: "population", label: "Population", kind: "int", synonyms: ["population", "pop", "census population", "population 2020"] },
  { key: "enrollment", label: "Enrollment", kind: "int", synonyms: ["enrollment", "students", "student enrollment", "adm", "total enrollment"] },
  { key: "annualBudget", label: "Annual budget ($)", kind: "money", synonyms: ["budget", "annual budget", "total budget", "general fund budget", "total expenditures", "expenditures", "operating budget"] },
  { key: "debtOutstanding", label: "Debt outstanding ($)", kind: "money", synonyms: ["debt", "debt outstanding", "outstanding debt", "total debt", "long term debt"] },
  { key: "debtLimit", label: "Debt limit ($)", kind: "money", synonyms: ["debt limit", "borrowing base", "debt capacity"] },
  { key: "buildingCount", label: "Building count", kind: "int", synonyms: ["buildings", "building count", "number of buildings", "num buildings", "facilities", "schools", "number of schools"] },
  { key: "oldestBuildingYear", label: "Oldest building (year built)", kind: "year", synonyms: ["oldest building", "oldest building year", "year built", "oldest year built", "oldest facility"] },
  { key: "oldestBuildingAge", label: "Oldest building age (years)", kind: "age", synonyms: ["building age", "oldest building age", "age of oldest building", "max building age"] },
  { key: "lastMajorRenovationYear", label: "Last major renovation (year)", kind: "year", synonyms: ["last renovation", "last major renovation", "renovation year", "last reno"] },
  { key: "lastEnergyProjectYear", label: "Last energy project (year)", kind: "year", synonyms: ["last energy project", "energy project year", "last esco project", "last gesa", "gesa year", "last energy project year", "last gesa year"] },
  { key: "lastEnergyProjectEsco", label: "Last energy project ESCO", kind: "esco", synonyms: ["esco", "last esco", "energy contractor", "esco name", "incumbent esco", "prior esco"] },
  { key: "capitalPlanUrl", label: "Capital plan link", kind: "url", synonyms: ["capital plan", "capital plan link", "capital plan url", "facilities plan"] },
  { key: "recentBondIssues", label: "Recent bond issues", kind: "text", synonyms: ["bonds", "bond issues", "recent bonds", "bond", "recent bond issues", "bond history"] },
  { key: "creditRating", label: "Credit rating", kind: "text", synonyms: ["rating", "credit rating", "moodys", "moody's", "s&p", "bond rating"] },
  { key: "fiscalStressStatus", label: "Fiscal-stress status", kind: "text", synonyms: ["fiscal stress", "fsms", "act 47", "stress", "fiscal stress score", "fiscal stress designation"] },
  { key: "governingBody", label: "Governing body", kind: "text", synonyms: ["governing body", "board", "board name"] },
  { key: "arcCounty", label: "ARC county (Y/N)", kind: "bool", synonyms: ["arc county", "arc", "appalachian"] },
  { key: "quandelTerritory", label: "In Quandel territory (Y/N)", kind: "bool", synonyms: ["quandel territory", "in territory", "territory y n"] },
  { key: "energyCommunity", label: "Energy community (Y/N)", kind: "bool", synonyms: ["energy community"] },
];

/** Columns appended to the organization's Notes as "Header: value" lines. */
export const NOTES_SYNONYMS = ["notes", "note", "comments", "key buildings and age", "key buildings age", "grants on file", "contact", "contact name title", "next step", "coal region", "aun", "governing code", "recent energy or gesa project", "last energy gesa project"];

/** field key → column index; `notes` → several column indexes */
export type Mapping = { [field: string]: number | undefined } & { notes?: number[] };
export type OnDuplicate = "fill" | "overwrite" | "skip";
export type Defaults = {
  state?: StateCode | ""; orgType?: string; tier?: Tier | ""; status?: OrgStatus | "";
  companyCodes?: string[]; // added to every row
  companyCodesWhenTier?: string[]; // added only to rows that have a tier (e.g. QES on a QES-tier column)
  source?: string; onDuplicate?: OnDuplicate; inferType?: boolean;
  /** per spreadsheet line: an existing organization id to treat as the same, or "new" */
  resolutions?: Record<string, string>;
};

const squash = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

/** Best-guess column for each field from header text. Each column is used at most once. */
export function guessMapping(headers: string[]): Mapping {
  const m = {} as Mapping;
  const used = new Set<number>();
  const h = headers.map(squash);
  for (const pass of ["exact", "contains"] as const) {
    for (const f of ORG_FIELDS) {
      if (m[f.key] != null) continue;
      const syn = f.synonyms.map(squash);
      const i = h.findIndex((x, i) => !used.has(i) && (pass === "exact" ? syn.includes(x) : syn.some((s) => s.length > 3 && (x.startsWith(s + " ") || x.endsWith(" " + s)))));
      if (i >= 0) { m[f.key] = i; used.add(i); }
    }
  }
  const notes = NOTES_SYNONYMS.map(squash);
  m.notes = h.map((x, i) => (notes.includes(x) && !used.has(i) ? i : -1)).filter((i) => i >= 0);
  // A free-text energy-project column also feeds the year and ESCO fields (both parsed from the text).
  const energyText = h.findIndex((x) => /\b(last|recent) energy\b/.test(x));
  if (energyText >= 0) {
    if (m.lastEnergyProjectYear == null) m.lastEnergyProjectYear = energyText;
    if (m.lastEnergyProjectEsco == null) m.lastEnergyProjectEsco = energyText;
    if (!m.notes.includes(energyText)) m.notes.push(energyText);
  }
  return m;
}

/* ───── value normalizers ───── */

const STATE_NAMES: Record<string, StateCode> = {
  pennsylvania: "PA", "new york": "NY", maryland: "MD", "new jersey": "NJ", delaware: "DE", ohio: "OH",
  "west virginia": "WV", virginia: "VA", "district of columbia": "DC", "washington dc": "DC",
};
const STATE_CODES = ["PA", "NY", "MD", "NJ", "DE", "OH", "WV", "VA", "DC"];
export function parseState(v: string): StateCode | null {
  const t = v.trim();
  if (!t) return null;
  if (STATE_CODES.includes(t.toUpperCase())) return t.toUpperCase() as StateCode;
  return STATE_NAMES[squash(t)] ?? null;
}

/** Org-type words seen in public lists → the org_type picklist values (SPEC §4.1). */
const TYPE_SYNONYMS: [RegExp, string][] = [
  [/\b(intermediate unit|boces|iu)\b/, "intermediate unit / BOCES"],
  [/\b(career (and )?tech(nical)?( center| school| institute)?|ctc|avts|vo tech|area vocational)\b/, "career-tech center"],
  [/\bcommunity college\b/, "community college"],
  [/\b(state university|state system|passhe|suny|university of)\b/, "state university"],
  [/\b(charter school|school district|sd|city school district|central school district|union free school district|ufsd|csd|school)\b/, "school district"],
  [/\bhousing authority\b/, "housing authority"],
  [/\b(redevelopment authority|land bank)\b/, "redevelopment authority"],
  [/\b(industrial development (agency|authority)|ida)\b/, "IDA"],
  [/\b(municipal authority|water authority|sewer authority|water and sewer authority|joint authority|authority)\b/, "municipal authority"],
  [/\bfire (district|company|department)\b/, "fire district"],
  [/\b(hospital|health system|medical center|health)\b/, "hospital / health system"],
  [/\b(department of transportation|dot|penndot|nysdot)\b/, "DOT"],
  [/\bcounty\b/, "county"],
  [/\b(city|cities)\b/, "city"],
  [/\b(borough|boro)\b/, "borough"],
  [/\b(township|twp)\b/, "township"],
  [/\btown\b/, "town"],
  [/\bvillage\b/, "village"],
  [/\b(college|university)\b/, "private college"],
];

/** Type labels too vague to trust over the organization's name ("College" may be a community college). */
const VAGUE_TYPES = ["college", "municipality", "municipal", "government", "local government", "school", "other", "public"];

/** Resolve a type cell (or, failing that, the name) to a picklist value present in `allowed`. */
export function resolveOrgType(typeCell: string, name: string, allowed: string[], inferFromName: boolean): { value: string | null; how: "column" | "name" | null } {
  const exact = allowed.find((a) => squash(a) === squash(typeCell));
  if (exact) return { value: exact, how: "column" };
  if (VAGUE_TYPES.includes(squash(typeCell)) && inferFromName) {
    for (const [re, v] of TYPE_SYNONYMS) if (re.test(squash(name)) && allowed.includes(v)) return { value: v, how: "name" };
  }
  if (typeCell.trim()) {
    for (const [re, v] of TYPE_SYNONYMS) if (re.test(squash(typeCell)) && allowed.includes(v)) return { value: v, how: "column" };
  }
  if (inferFromName && name.trim()) {
    for (const [re, v] of TYPE_SYNONYMS) if (re.test(squash(name)) && allowed.includes(v)) return { value: v, how: "name" };
  }
  return { value: null, how: null };
}

export function parseMoney(v: string): number | null | "bad" {
  const t = v.replace(/[$,\s]/g, "").toLowerCase();
  if (!t || t === "-" || t === "n/a" || t === "na") return null;
  const m = t.match(/^(-?\d+(?:\.\d+)?)(k|m|mm|b)?$/);
  if (!m) return "bad";
  const mult = m[2] === "k" ? 1e3 : m[2] === "m" || m[2] === "mm" ? 1e6 : m[2] === "b" ? 1e9 : 1;
  return Math.round(Number(m[1]) * mult * 100) / 100;
}

export function parseIntCell(v: string): number | null | "bad" {
  const t = v.replace(/[,\s]/g, "");
  if (!t || t === "-" || /^n\/?a$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : "bad";
}

export function parseYear(v: string): number | null | "bad" {
  const t = v.trim();
  if (!t || t === "-" || /^n\/?a$/i.test(t) || /^none$/i.test(t)) return null;
  const m = t.match(/(18|19|20)\d{2}/);
  return m ? Number(m[0]) : "bad";
}

export function parseTier(v: string): Tier | null | "bad" {
  const t = v.trim().toUpperCase().replace(/^TIER\s*/, "");
  if (!t) return null;
  return t === "A" || t === "B" || t === "C" ? t : t === "1" ? "A" : t === "2" ? "B" : t === "3" ? "C" : "bad";
}

export function parseBool(v: string): boolean | null | "bad" {
  const t = squash(v);
  if (!t) return null;
  if (["y", "yes", "true", "1", "x"].includes(t)) return true;
  if (["n", "no", "false", "0"].includes(t)) return false;
  return "bad";
}

/** ESCOs named in SPEC §4.13. A long free-text cell yields the ESCO only if one of these appears. */
const KNOWN_ESCOS = ["Quandel Energy Solutions", "SitelogIQ", "Ameresco", "Veregy", "Johnson Controls", "Siemens", "Trane", "NORESCO", "NYPA"];
export function parseEsco(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const hit = KNOWN_ESCOS.find((e) => t.toLowerCase().includes(e.toLowerCase())) ?? (/\bQES\b/.test(t) ? "Quandel Energy Solutions" : undefined);
  if (hit) return hit;
  return t.length <= 40 && !/\d/.test(t) ? t : null;
}

const STATUS_WORDS: Record<string, OrgStatus> = { target: "TARGET", prospect: "TARGET", active: "ACTIVE", client: "CLIENT", customer: "CLIENT", dormant: "DORMANT", inactive: "DORMANT", "do not pursue": "DO_NOT_PURSUE", dnp: "DO_NOT_PURSUE" };
export function parseStatus(v: string): OrgStatus | null | "bad" {
  const t = squash(v);
  if (!t) return null;
  if (STATUS_WORDS[t]) return STATUS_WORDS[t];
  if (/\bclient\b/.test(t)) return "CLIENT"; // e.g. "QES client"
  return "bad";
}

export function parseCompanies(v: string, known: string[]): string[] {
  return v.toUpperCase().split(/[^A-Z]+/).filter((c) => known.includes(c));
}

/** Strip stray leading symbols (e.g. "|  [[Earl Township") and collapse spaces. */
export const cleanName = (s: string) => s.replace(/^[^A-Za-z0-9]+/, "").replace(/\s+/g, " ").trim();
export const normalizeName = (s: string) => squash(cleanName(s)).replace(/\s+/g, " ");
const normCounty = (c: string | null | undefined) => squash((c ?? "").replace(/\s+county$/i, ""));
/** Exact duplicate key: name + state + type + county. */
export const dupKey = (name: string, state: string, orgType: string, county?: string | null) => `${normalizeName(name)}|${state}|${orgType}|${normCounty(county)}`;

/**
 * Loose key for "probably the same organization": ignores word order, "&"/"and",
 * "Intermediate Unit"/"IU", and filler words like City, Area, The, Of, County.
 */
const FILLER = new Set(["the", "of", "city", "area", "county", "and", "pennsylvania"]);
export function looseName(name: string): string {
  return normalizeName(name)
    .replace(/\bsd\b/g, "school district")
    .replace(/\btwp\b/g, "township")
    .replace(/\bctc\b/g, "career tech center")
    .replace(/\bintermediate unit\b/g, "iu")
    .replace(/\btechnology\b|\btechnical\b/g, "tech")
    .replace(/\bcenters\b/g, "center")
    .split(" ")
    .filter((w) => w && !FILLER.has(w))
    .sort()
    .join(" ");
}
const looseKey = (name: string, state: string, orgType: string) => `${looseName(name)}|${state}|${orgType}`;

/* ───── preview ───── */

export type OrgDraft = {
  name: string; orgType: string; state: StateCode; county: string | null; region: string | null; address: string | null; website: string | null;
  tier: Tier | null; status: OrgStatus | null; companyCodes: string[];
  population: number | null; enrollment: number | null; annualBudget: number | null; debtOutstanding: number | null; debtLimit: number | null;
  buildingCount: number | null; oldestBuildingYear: number | null; lastMajorRenovationYear: number | null; lastEnergyProjectYear: number | null;
  lastEnergyProjectEsco: string | null; capitalPlanUrl: string | null; recentBondIssues: string | null; creditRating: string | null;
  fiscalStressStatus: string | null; governingBody: string | null;
  arcCounty: boolean | null; quandelTerritory: boolean | null; energyCommunity: boolean | null; notes: string | null;
};

export type ExistingOrg = { id: string; name: string; state: string; orgType: string; county: string | null; companyCodes: string[] } & Partial<Record<keyof OrgDraft, unknown>>;

export type PreviewRow = {
  line: number; // spreadsheet row number
  action: "create" | "update" | "skip" | "error";
  /** set when a similarly named organization exists in another county: a person decides */
  possible?: { id: string; name: string; county: string | null };
  /** how this row was tied to an existing organization */
  matchedBy?: "exact" | "similar" | "person";
  reason?: string;
  errors: string[];
  notes: string[];
  draft: Partial<OrgDraft>;
  matchId?: string;
  matchName?: string;
  changes?: string[]; // field labels that would change on update
};

const SCALARS: (keyof OrgDraft)[] = ["arcCounty", "quandelTerritory", "energyCommunity", "county", "region", "address", "website", "tier", "status", "population", "enrollment", "annualBudget", "debtOutstanding", "debtLimit", "buildingCount", "oldestBuildingYear", "lastMajorRenovationYear", "lastEnergyProjectYear", "lastEnergyProjectEsco", "capitalPlanUrl", "recentBondIssues", "creditRating", "fiscalStressStatus", "governingBody"];
const LABEL = Object.fromEntries(ORG_FIELDS.map((f) => [f.key, f.label])) as Record<string, string>;

export function buildPreview(input: {
  headers: string[]; rows: string[][]; headerRow: number; mapping: Mapping; defaults: Defaults;
  allowedTypes: string[]; companyCodes: string[]; existing: ExistingOrg[]; currentYear: number;
}): { rows: PreviewRow[]; counts: Record<PreviewRow["action"], number> } {
  const { rows, mapping, defaults, allowedTypes, companyCodes, existing, headerRow, currentYear } = input;
  const cell = (r: string[], key: string) => {
    const c = mapping[key];
    return typeof c === "number" ? (r[c] ?? "").trim() : "";
  };
  const byKey = new Map(existing.map((e) => [dupKey(e.name, e.state, e.orgType, e.county), e]));
  const byLoose = new Map<string, ExistingOrg[]>();
  for (const e of existing) {
    const k = looseKey(e.name, e.state, e.orgType);
    byLoose.set(k, [...(byLoose.get(k) ?? []), e]);
  }
  const byId = new Map(existing.map((e) => [e.id, e]));
  const resolutions = defaults.resolutions ?? {};
  const seen = new Map<string, number>();
  const onDup = defaults.onDuplicate ?? "fill";
  const out: PreviewRow[] = [];

  rows.forEach((r, i) => {
    const line = headerRow + 1 + i;
    const errors: string[] = [];
    const notes: string[] = [];
    const rawName = cell(r, "name");
    const name = cleanName(rawName);
    if (!name && r.filter((c) => c.trim()).length <= 1) {
      out.push({ line, action: "skip", reason: "Note or blank row", errors, notes, draft: {} });
      return;
    }
    if (!name) errors.push("No name");
    else if (name !== rawName.replace(/\s+/g, " ").trim()) notes.push(`Name cleaned from "${rawName}"`);
    const stateCell = cell(r, "state");
    const state = parseState(stateCell) ?? (stateCell ? null : (defaults.state || null));
    if (!state) errors.push(stateCell ? `State "${stateCell}" not recognized` : "No state (map a column or set a default)");
    const typeCell = cell(r, "orgType");
    let { value: orgType, how } = resolveOrgType(typeCell, name, allowedTypes, defaults.inferType !== false);
    if (!orgType && defaults.orgType && allowedTypes.includes(defaults.orgType)) { orgType = defaults.orgType; how = null; }
    if (!orgType) errors.push(typeCell ? `Type "${typeCell}" not in the org-type list` : "No type (map a column, let the importer infer it from the name, or set a default)");
    else if (how === "name") notes.push(`Type taken from name: ${orgType}`);

    const num = (key: string, f: (v: string) => number | null | "bad") => {
      const raw = cell(r, key);
      const v = f(raw);
      if (v === "bad") { notes.push(`${LABEL[key]}: "${raw}" ignored (not a number)`); return null; }
      return v;
    };
    let oldest = num("oldestBuildingYear", parseYear);
    const age = num("oldestBuildingAge", parseIntCell);
    if (oldest == null && age != null && age > 0 && age < 300) { oldest = currentYear - age; notes.push(`Oldest building year ${oldest} from age ${age}`); }
    const tierRaw = cell(r, "tier");
    const tierP = parseTier(tierRaw);
    if (tierP === "bad") notes.push(`Tier "${tierRaw}" ignored`);
    const statusRaw = cell(r, "status");
    const statusP = parseStatus(statusRaw);
    if (statusP === "bad") notes.push(`Status "${statusRaw}" ignored`);
    const website = cell(r, "website");
    const capUrl = cell(r, "capitalPlanUrl");
    const url = (u: string) => (!u ? null : /^https?:\/\//i.test(u) ? u : /^[\w-]+(\.[\w-]+)+/.test(u) ? `https://${u}` : null);

    const draft: Partial<OrgDraft> = {
      name, orgType: orgType ?? undefined, state: state ?? undefined,
      county: cell(r, "county").replace(/\s+county$/i, "") || null,
      region: cell(r, "region") || null, address: cell(r, "address") || null, website: url(website),
      tier: (tierP !== "bad" ? tierP : null) ?? (defaults.tier || null),
      status: (statusP !== "bad" ? statusP : null) ?? (defaults.status || null),
      companyCodes: [...new Set([...parseCompanies(cell(r, "companies"), companyCodes), ...(defaults.companyCodes ?? [])])],
      population: num("population", parseIntCell), enrollment: num("enrollment", parseIntCell),
      annualBudget: num("annualBudget", parseMoney), debtOutstanding: num("debtOutstanding", parseMoney), debtLimit: num("debtLimit", parseMoney),
      buildingCount: num("buildingCount", parseIntCell), oldestBuildingYear: oldest,
      lastMajorRenovationYear: num("lastMajorRenovationYear", parseYear), lastEnergyProjectYear: num("lastEnergyProjectYear", parseYear),
      capitalPlanUrl: url(capUrl),
      recentBondIssues: cell(r, "recentBondIssues") || null, creditRating: cell(r, "creditRating") || null,
      fiscalStressStatus: cell(r, "fiscalStressStatus") || null, governingBody: cell(r, "governingBody") || null,
    };
    if (website && !draft.website) notes.push(`Website "${website}" ignored`);
    const bool = (key: keyof OrgDraft) => {
      const raw = cell(r, key);
      const v = parseBool(raw);
      if (v === "bad") { notes.push(`${LABEL[key]}: "${raw}" ignored`); return null; }
      return v;
    };
    draft.arcCounty = bool("arcCounty");
    draft.quandelTerritory = bool("quandelTerritory");
    draft.energyCommunity = bool("energyCommunity");
    const escoRaw = cell(r, "lastEnergyProjectEsco");
    draft.lastEnergyProjectEsco = parseEsco(escoRaw);
    if (escoRaw && !draft.lastEnergyProjectEsco && mapping.lastEnergyProjectEsco !== mapping.lastEnergyProjectYear) notes.push(`ESCO not recognized in "${escoRaw.slice(0, 60)}"`);
    if (draft.tier && defaults.companyCodesWhenTier?.length) draft.companyCodes = [...new Set([...(draft.companyCodes ?? []), ...defaults.companyCodesWhenTier])];
    const noteLines = (mapping.notes ?? []).map((i) => [input.headers[i], (r[i] ?? "").trim()] as const).filter(([, v]) => v).map(([h, v]) => `${h}: ${v}`);
    draft.notes = noteLines.length ? noteLines.join("\n") : null;

    if (errors.length) { out.push({ line, action: "error", errors, notes, draft }); return; }
    const key = dupKey(name, state!, orgType!, draft.county);
    if (seen.has(key)) { out.push({ line, action: "skip", reason: `Same name, state, type and county as row ${seen.get(key)}`, errors, notes, draft }); return; }
    seen.set(key, line);

    // Exact match; else a person's earlier decision; else a similar name in the same county.
    let match = byKey.get(key);
    let matchedBy: PreviewRow["matchedBy"] = match ? "exact" : undefined;
    let possible: PreviewRow["possible"];
    const decided = resolutions[String(line)];
    if (!match && decided && decided !== "new" && byId.has(decided)) { match = byId.get(decided); matchedBy = "person"; }
    if (!match && decided !== "new") {
      const similar = byLoose.get(looseKey(name, state!, orgType!)) ?? [];
      const sameCounty = similar.find((e) => normCounty(e.county) === normCounty(draft.county));
      if (sameCounty) { match = sameCounty; matchedBy = "similar"; notes.push(`Matched by similar name: ${sameCounty.name}`); }
      else if (similar.length) possible = { id: similar[0].id, name: similar[0].name, county: similar[0].county };
    }
    if (!match) { out.push({ line, action: "create", errors, notes, draft, possible }); return; }
    if (onDup === "skip") { out.push({ line, action: "skip", reason: "Already in the CRM", errors, notes, draft, matchId: match.id, matchName: match.name, matchedBy }); return; }
    const changes: string[] = [];
    for (const k of SCALARS) if (wouldChange(match[k], draft[k], onDup)) changes.push(LABEL[k] ?? k);
    const m = match;
    const newCos = (draft.companyCodes ?? []).filter((c) => !m.companyCodes.includes(c));
    if (newCos.length) changes.push(`Company tags +${newCos.join(", ")}`);
    if (draft.notes && !String(m.notes ?? "").includes(draft.notes)) changes.push("Notes (appended)");
    out.push(changes.length
      ? { line, action: "update", errors, notes, draft, matchId: m.id, matchName: m.name, changes, matchedBy }
      : { line, action: "skip", reason: "Already in the CRM; nothing new", errors, notes, draft, matchId: m.id, matchName: m.name, matchedBy });
  });
  const counts = { create: 0, update: 0, skip: 0, error: 0 };
  for (const r of out) counts[r.action]++;
  return { rows: out, counts };
}

/**
 * Whether an incoming value should replace the current one. "fill" only fills blanks;
 * a false flag counts as blank (flags default to false), and No never clears a Yes in fill mode.
 */
function wouldChange(cur: unknown, v: unknown, onDup: OnDuplicate): boolean {
  if (v == null) return false;
  if (cur != null && String(cur) === String(v)) return false;
  if (typeof v === "boolean") return onDup === "overwrite" ? true : v === true && cur !== true;
  if (onDup === "fill" && cur != null && cur !== "") return false;
  return true;
}

/** The fields to write for a preview row (respecting fill vs overwrite on updates). */
export function updateData(row: PreviewRow, existing: ExistingOrg, onDup: OnDuplicate): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  if (row.draft.notes && !String(existing.notes ?? "").includes(row.draft.notes))
    d.notes = existing.notes ? `${existing.notes}\n${row.draft.notes}` : row.draft.notes;
  for (const k of SCALARS) {
    const v = row.draft[k];
    if (!wouldChange(existing[k], v, onDup)) continue;
    d[k] = typeof v === "number" && ["annualBudget", "debtOutstanding", "debtLimit"].includes(k) ? String(v) : v;
  }
  return d;
}
