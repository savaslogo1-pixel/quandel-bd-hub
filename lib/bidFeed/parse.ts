// Bid-feed intake: turn a JSON batch (or the tracker file) into rows.
// Pure functions — no database. Dollar amounts are taken only when the text states one
// figure. A range or an "up to" ceiling stays as text and is not turned into a number.
import type { BidFeedKind, BidFeedPriority, DeliveryMethod, StateCode } from "@prisma/client";
import picklists from "@/data/picklists.json";
import { parseState, resolveOrgType } from "@/lib/import/orgs";

export const BID_FEED_BATCH_LIMIT = 500;
/** "Due soon" review window on the Bid feed page. Not a procurement threshold. */
export const DUE_SOON_DAYS = 14;

export const KIND_LABELS: Record<BidFeedKind, string> = {
  RFP: "RFP",
  RFQ: "RFQ",
  IFB: "IFB / bid",
  MEETING_MINUTES: "Meeting minutes",
  OTHER: "Other",
};

export const STATUS_LABELS = {
  NEW: "New",
  APPROVED: "Approved",
  DISMISSED: "Dismissed",
  ON_HOLD: "On hold",
} as const;

export type BidFeedStatusName = keyof typeof STATUS_LABELS;

export const PRIORITY_LABELS: Record<BidFeedPriority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  WATCH: "Watch",
};

const PRIORITY_RANK: Record<BidFeedPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, WATCH: 3 };

/** Sweep codes that are not the hub's company codes. PERF is Performance (PCS). */
const COMPANY_ALIASES: Record<string, string> = {
  QCG: "QCG",
  QES: "QES",
  PCS: "PCS",
  PERF: "PCS",
  PERFORMANCE: "PCS",
  JVS: "JVS",
  PYR: "PYR",
  ENT: "ENT",
};

export const ORG_TYPES = picklists.lists.org_type;

export type BidFeedInput = {
  externalKey: string;
  title: string;
  ownerName: string;
  county: string | null;
  location: string | null;
  state: StateCode;
  kind: BidFeedKind;
  typeLabel: string | null;
  estimatedValue: number | null;
  valueText: string | null;
  dueAt: Date | null;
  preBidAt: Date | null;
  preBidText: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  priority: BidFeedPriority;
  notes: string | null;
  why: string | null;
  companyCodes: string[]; // canonical codes, lead first
};

export type ItemError = { index: number | null; externalKey: string | null; message: string };

export type BatchParse =
  | { ok: false; error: string }
  | { ok: true; items: BidFeedInput[]; errors: ItemError[] };

const LIMITS = {
  externalKey: 1000,
  title: 500,
  ownerName: 300,
  county: 120,
  location: 200,
  valueText: 1000,
  notes: 8000,
  why: 2000,
  sourceUrl: 1000,
  sourceName: 200,
  type: 120,
  preBid: 500,
};

/** True when Authorization is `Bearer $BID_FEED_SECRET`. An empty secret never matches. */
export function bidFeedAuthorized(authorization: string | null | undefined): boolean {
  const secret = process.env.BID_FEED_SECRET;
  if (!secret || !authorization) return false;
  return authorization === `Bearer ${secret}`;
}

const BARE_TYPES = new Set(["rfp", "rfq", "ifb", "itb", "bid", "meeting minutes", "meeting-minutes", "meeting_minutes", "other"]);

/** Map a published type string onto the feed's kind. The original is kept when it adds detail. */
export function classifyKind(type: string): { kind: BidFeedKind; typeLabel: string | null } {
  const t = type.trim();
  const s = t.toLowerCase();
  let kind: BidFeedKind = "OTHER";
  if (/meeting/.test(s)) kind = "MEETING_MINUTES";
  else if (/\brfq\b/.test(s)) kind = "RFQ";
  else if (/\brfp\b/.test(s)) kind = "RFP";
  else if (/\b(ifb|itb)\b/.test(s) || /\bbid\b/.test(s)) kind = "IFB";
  return { kind, typeLabel: BARE_TYPES.has(s) ? null : t };
}

const NOT_AN_AMOUNT = /^(not stated|n\/a|na|tbd|unknown|none|—|-|tbd\.)$/i;
const MONEY = /\$\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|billion|m|mm|k|b)?\b/gi;

function moneyValue(num: string, unit?: string): number {
  const n = Number(num.replace(/,/g, ""));
  const u = (unit ?? "").toLowerCase();
  const mult = u === "k" ? 1e3 : u === "m" || u === "mm" || u === "million" ? 1e6 : u === "b" || u === "billion" ? 1e9 : 1;
  return Math.round(n * mult);
}

/**
 * A single published dollar figure, or null. Ranges ("$11M–$12M"), ceilings ("up to $12M")
 * and text with more than one figure return null so the pipeline is not given an invented number.
 */
export function parseEstimate(text: string | null | undefined): number | null {
  if (text == null) return null;
  const raw = text.trim();
  if (!raw || NOT_AN_AMOUNT.test(raw)) return null;
  if (/\bup to\b/i.test(raw)) return null;
  if (/\d(?:\.\d+)?\s*(?:million|billion|m|mm|k|b)?\s*[–—-]\s*\$?\s*\d/i.test(raw)) return null;
  if (/\$\s*[\d,.]+\s*(?:million|billion|m|mm|k|b)?\s+to\s+\$/i.test(raw)) return null;
  const hits = [...raw.matchAll(MONEY)].map((m) => moneyValue(m[1], m[2]));
  if (hits.length !== 1) return null;
  return hits[0];
}

/** Pull a calendar date (and optional clock time) off the front of a published date line. */
export function parseWhen(input: unknown): { at: Date | null; rest: string | null } {
  if (input == null || input === "") return { at: null, rest: null };
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? { at: null, rest: null } : { at: input, rest: null };
  const raw = String(input).trim();
  if (!raw || /^(n\/a|na|tbd|none|not stated|held|—|-)$/i.test(raw)) return { at: null, rest: raw === "—" || raw === "-" ? null : raw };
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const at = new Date(Date.UTC(year, month - 1, day, Number(iso[4] ?? 0), Number(iso[5] ?? 0), Number(iso[6] ?? 0)));
    if (at.getUTCFullYear() !== year || at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return { at: null, rest: raw };
    const rest = raw.slice(iso[0].length).replace(/^[\s,]+/, "").replace(/^\((.*)\)$/, "$1").trim();
    return { at, rest: rest || null };
  }
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?/);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    const year = Number(us[3]);
    const at = new Date(Date.UTC(year, month - 1, day, Number(us[4] ?? 0), Number(us[5] ?? 0)));
    if (at.getUTCFullYear() !== year || at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return { at: null, rest: raw };
    const rest = raw.slice(us[0].length).replace(/^[\s,]+/, "").trim();
    return { at, rest: rest || null };
  }
  return { at: null, rest: raw };
}

const TOKEN_WORD: Record<string, string> = {
  dept: "department",
  depts: "departments",
  univ: "university",
  twp: "township",
  boro: "borough",
  pa: "pennsylvania",
};

/**
 * Comparison key for owner names. Punctuation, parentheticals ("via DGS"), "Dept."/"Department"
 * and a leading "Pennsylvania" don't keep two spellings of the same owner apart.
 */
export function orgMatchKey(name: string): string {
  const tokens = name
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => TOKEN_WORD[w] ?? w)
    .filter((w) => !["the", "inc", "llc", "corp", "corporation", "ltd", "company"].includes(w));
  return tokens.join(" ").replace(/^pennsylvania\s+/, "");
}

export function namesMatch(a: string, b: string): boolean {
  const ka = orgMatchKey(a);
  const kb = orgMatchKey(b);
  return ka.length > 0 && ka === kb;
}

export function cleanOwnerName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/** "Dauphin County" and "Dauphin" are the same county. Multi-county lines are kept whole. */
export function cleanCounty(county: string | null | undefined): string | null {
  if (!county) return null;
  const t = county.replace(/\s+/g, " ").trim().replace(/\s+county$/i, "");
  return t || null;
}

export function normCounty(county: string | null | undefined): string {
  return (cleanCounty(county) ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function canonicalCompanies(input: unknown): { codes: string[] } | { error: string } {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[,;/]+/)
      : input == null || input === ""
        ? []
        : null;
  if (!raw) return { error: "Companies must be a list of company codes." };
  const codes: string[] = [];
  for (const entry of raw) {
    const token = String(entry).trim().toUpperCase();
    if (!token) continue;
    const code = COMPANY_ALIASES[token];
    if (!code) return { error: `Unknown company "${String(entry).trim()}". Use QCG, QES, PCS, JVS, PYR or ENT. The sweep's PERF code is Performance (PCS).` };
    if (!codes.includes(code)) codes.push(code);
  }
  return { codes };
}

export function inferOrgType(name: string): { value: string; confirm: boolean } {
  const resolved = resolveOrgType("", name, ORG_TYPES, true);
  if (resolved.value) return { value: resolved.value, confirm: false };
  if (/\b(dept\.?|department|agency|commonwealth|bureau|dgs|dmva|administration)\b/i.test(name) && ORG_TYPES.includes("state agency")) {
    return { value: "state agency", confirm: false };
  }
  return { value: "state agency", confirm: true };
}

/** A project type and delivery method only when the text says so. Otherwise both stay blank. */
export function inferPursuit(item: { kind: BidFeedKind; typeLabel: string | null; title: string; why: string | null; valueText: string | null }): { projectType: string | null; deliveryMethod: DeliveryMethod | null } {
  const text = `${item.typeLabel ?? ""} ${item.title} ${item.why ?? ""} ${item.valueText ?? ""}`.toLowerCase();
  let deliveryMethod: DeliveryMethod | null = null;
  if (/\b(gesa|esco|espc)\b/.test(text)) deliveryMethod = "GESA_EPC";
  else if (/\b(cmr|cmar|cm at risk|cm-at-risk)\b/.test(text)) deliveryMethod = "CM_AT_RISK";
  else if (/\b(owner'?s rep|cm agency)\b/.test(text)) deliveryMethod = "CM_AGENCY";

  let projectType: string | null = null;
  if (/\b(bridge|culvert)\b/.test(text)) projectType = "bridge";
  else if (/\b(wwtp|wastewater|water treatment|sewer)\b/.test(text)) projectType = "water/wastewater";
  else if (deliveryMethod === "GESA_EPC" || /\b(energy audit|solar|geothermal)\b/.test(text)) projectType = "energy";
  else if (/\bhousing\b/.test(text)) projectType = "housing";
  return { projectType, deliveryMethod };
}

export function creationNote(item: Pick<BidFeedInput, "sourceName" | "sourceUrl" | "valueText" | "why" | "preBidText">): string {
  const lines = ["Created from the bid feed at stage 1 (Target)."];
  if (item.sourceName) lines.push(`Source: ${item.sourceName}`);
  if (item.sourceUrl) lines.push(item.sourceUrl);
  if (item.valueText) lines.push(`Published estimate: ${item.valueText}`);
  if (item.why) lines.push(item.why);
  if (item.preBidText) lines.push(`Pre-bid: ${item.preBidText}`);
  return lines.join("\n").slice(0, 4000);
}

export function compareBidItems<T extends { dueAt: Date | null; priority: BidFeedPriority; title: string }>(a: T, b: T): number {
  if (a.dueAt && b.dueAt) {
    const d = a.dueAt.getTime() - b.dueAt.getTime();
    if (d) return d;
  } else if (a.dueAt) return -1;
  else if (b.dueAt) return 1;
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (p) return p;
  return a.title.localeCompare(b.title);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function text(v: unknown, max: number): { value: string | null; error?: string } {
  if (v == null || v === "") return { value: null };
  if (typeof v !== "string" && typeof v !== "number") return { value: null, error: "Expected text." };
  const t = String(v).trim();
  if (!t) return { value: null };
  if (t.length > max) return { value: null, error: `Must be ${max} characters or fewer.` };
  return { value: t };
}

function plainNumber(v: unknown): number | null | "bad" | "absent" {
  if (v == null || v === "") return "absent";
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : "bad";
  if (typeof v === "string" && /^\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*$/.test(v.trim())) {
    const n = Number(v.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : "bad";
  }
  return "bad";
}

function httpUrl(v: string | null): string | null {
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : null;
}

function isLeadShape(raw: Record<string, unknown>): boolean {
  return typeof raw.project === "string" && typeof raw.entity === "string" && typeof raw.title !== "string";
}

/** One intake object, in the API shape or the tracker shape (id, owner, value, due, pre_bid, url, source). */
export function normalizeItem(raw: unknown): { ok: true; item: BidFeedInput } | { ok: false; externalKey: string | null; message: string } {
  const rec = asRecord(raw);
  if (!rec) return { ok: false, externalKey: null, message: "Each item must be an object." };

  const key = text(rec.externalKey ?? rec.id, LIMITS.externalKey);
  if (key.error) return { ok: false, externalKey: null, message: `External key: ${key.error}` };
  const externalKey = key.value ?? httpUrl(text(rec.url ?? rec.sourceUrl, LIMITS.sourceUrl).value);
  if (!externalKey) return { ok: false, externalKey: null, message: "An external key (or id) is required so the same item can be updated instead of duplicated." };

  const lead = isLeadShape(rec);
  const titleField = text(rec.title ?? rec.project, LIMITS.title);
  if (titleField.error) return { ok: false, externalKey, message: `Title: ${titleField.error}` };
  if (!titleField.value) return { ok: false, externalKey, message: "Title is required." };

  const ownerField = text(rec.ownerName ?? rec.owner ?? rec.entity, LIMITS.ownerName);
  if (ownerField.error) return { ok: false, externalKey, message: `Owner: ${ownerField.error}` };
  if (!ownerField.value) return { ok: false, externalKey, message: "Owner name is required." };

  const typeField = text(rec.type, LIMITS.type);
  if (typeField.error) return { ok: false, externalKey, message: `Type: ${typeField.error}` };
  if (!typeField.value && !lead) return { ok: false, externalKey, message: "Type is required (RFP, RFQ, IFB, or meeting minutes)." };
  const classified = classifyKind(typeField.value ?? "meeting minutes");

  const companies = canonicalCompanies(rec.companies);
  if ("error" in companies) return { ok: false, externalKey, message: companies.error };

  const explicit = plainNumber(rec.estimatedValue);
  if (explicit === "bad") return { ok: false, externalKey, message: "Estimated value must be a number zero or greater. Put a range in valueText." };
  const valueField = text(rec.valueText ?? rec.value ?? rec.budget, LIMITS.valueText);
  if (valueField.error) return { ok: false, externalKey, message: `Value: ${valueField.error}` };
  const estimatedValue = explicit === "absent" ? parseEstimate(valueField.value) : explicit;

  const due = parseWhen(rec.dueDate ?? rec.due);
  const pre = parseWhen(rec.preBidDate ?? rec.preBid ?? rec.pre_bid);
  const preRaw = text(rec.preBidText ?? rec.pre_bid ?? rec.preBid, LIMITS.preBid);
  if (preRaw.error) return { ok: false, externalKey, message: `Pre-bid: ${preRaw.error}` };

  const urlField = text(rec.sourceUrl ?? rec.url, LIMITS.sourceUrl);
  if (urlField.error) return { ok: false, externalKey, message: `Source URL: ${urlField.error}` };
  const sourceUrl = httpUrl(urlField.value);
  const sourceField = text(rec.sourceName ?? rec.source, LIMITS.sourceName);
  if (sourceField.error) return { ok: false, externalKey, message: `Source name: ${sourceField.error}` };

  const priorityRaw = text(rec.priority, 40);
  if (priorityRaw.error) return { ok: false, externalKey, message: `Priority: ${priorityRaw.error}` };
  if (!priorityRaw.value) return { ok: false, externalKey, message: "Priority is required (High, Medium, Low or Watch)." };
  const priority = ({ high: "HIGH", medium: "MEDIUM", low: "LOW", watch: "WATCH" } as Record<string, BidFeedPriority>)[priorityRaw.value.toLowerCase()];
  if (!priority) return { ok: false, externalKey, message: "Priority must be High, Medium, Low or Watch." };

  const stateRaw = text(rec.state, 40);
  if (stateRaw.error) return { ok: false, externalKey, message: `State: ${stateRaw.error}` };
  const state = stateRaw.value ? parseState(stateRaw.value) : "PA";
  if (!state) return { ok: false, externalKey, message: "State must be a known state code (PA, NY, MD, NJ, DE, OH, WV, VA or DC)." };

  const county = text(rec.county, LIMITS.county);
  if (county.error) return { ok: false, externalKey, message: `County: ${county.error}` };
  const location = text(rec.location, LIMITS.location);
  if (location.error) return { ok: false, externalKey, message: `Location: ${location.error}` };
  const why = text(rec.why, LIMITS.why);
  if (why.error) return { ok: false, externalKey, message: `Why: ${why.error}` };
  const notesField = text(rec.notes, LIMITS.notes);
  if (notesField.error) return { ok: false, externalKey, message: `Notes: ${notesField.error}` };

  const noteLines: string[] = [];
  if (notesField.value) noteLines.push(notesField.value);
  if (lead) {
    const stage = text(rec.stage, 1000).value;
    const timing = text(rec.timing, 1000).value;
    const signal = text(rec.date, 40).value;
    if (stage) noteLines.push(`Stage: ${stage}`);
    if (timing) noteLines.push(`Timing: ${timing}`);
    if (signal) noteLines.push(`Signal date: ${signal}`);
  }
  if (urlField.value && !sourceUrl) noteLines.push(`Reference: ${urlField.value}`);
  if (due.rest && (rec.dueDate != null || rec.due != null)) noteLines.push(`Due: ${due.rest}`);
  const notes = noteLines.join("\n") || null;
  if (notes && notes.length > LIMITS.notes) return { ok: false, externalKey, message: `Notes must be ${LIMITS.notes} characters or fewer.` };

  return {
    ok: true,
    item: {
      externalKey,
      title: titleField.value,
      ownerName: cleanOwnerName(ownerField.value),
      county: cleanCounty(county.value),
      location: location.value,
      state,
      kind: classified.kind,
      typeLabel: classified.typeLabel,
      estimatedValue,
      valueText: valueField.value,
      dueAt: due.at,
      preBidAt: pre.at,
      preBidText: pre.rest ?? (pre.at ? null : preRaw.value),
      sourceUrl,
      sourceName: sourceField.value ?? (lead ? (sourceUrl ? "Meeting minutes" : "Internal notes") : null),
      priority,
      notes,
      why: why.value,
      companyCodes: companies.codes,
    },
  };
}

/** `{ items: [...] }` — the intake contract. Item-level problems are returned beside the valid items. */
export function parseBidFeedBatch(body: unknown): BatchParse {
  const rec = asRecord(body);
  if (!rec || !Array.isArray(rec.items)) return { ok: false, error: 'Expected a JSON object with an "items" array.' };
  if (rec.items.length > BID_FEED_BATCH_LIMIT) return { ok: false, error: `A batch can hold at most ${BID_FEED_BATCH_LIMIT} items.` };
  const items: BidFeedInput[] = [];
  const errors: ItemError[] = [];
  rec.items.forEach((row, index) => {
    const n = normalizeItem(row);
    if (n.ok) items.push(n.item);
    else errors.push({ index, externalKey: n.externalKey, message: n.message });
  });
  return { ok: true, items, errors };
}

/** The tracker file: open solicitations plus meeting-minute leads. */
export function trackerToBatch(data: unknown): BatchParse {
  const rec = asRecord(data);
  if (!rec) return { ok: false, error: "Tracker file is not a JSON object." };
  const sols = Array.isArray(rec.open_solicitations) ? rec.open_solicitations : [];
  const leads = Array.isArray(rec.leads) ? rec.leads : [];
  return parseBidFeedBatch({ items: [...sols, ...leads] });
}
