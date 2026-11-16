import { readFileSync } from "node:fs";
import path from "node:path";
import {
  bidFeedAuthorized,
  canonicalCompanies,
  classifyKind,
  inferOrgType,
  inferPursuit,
  namesMatch,
  orgMatchKey,
  parseBidFeedBatch,
  parseEstimate,
  parseWhen,
  trackerToBatch,
} from "../lib/bidFeed/parse";

let fail = 0;
const eq = (a: unknown, b: unknown, m: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fail++;
    console.log("FAIL", m, "\n  got ", JSON.stringify(a), "\n  want", JSON.stringify(b));
  } else console.log("ok  ", m);
};

// ── auth ────────────────────────────────────────────────────────────────────
const savedSecret = process.env.BID_FEED_SECRET;
process.env.BID_FEED_SECRET = "";
eq(bidFeedAuthorized("Bearer "), false, "empty secret never authorizes");
process.env.BID_FEED_SECRET = "sweep-secret";
eq(bidFeedAuthorized(null), false, "missing header is unauthorized");
eq(bidFeedAuthorized("Bearer wrong"), false, "wrong bearer is unauthorized");
eq(bidFeedAuthorized("sweep-secret"), false, "secret without the Bearer prefix is unauthorized");
eq(bidFeedAuthorized("Bearer sweep-secret"), true, "matching bearer is authorized");
process.env.BID_FEED_SECRET = savedSecret;

// ── classification, money, dates, companies ────────────────────────────────
eq(classifyKind("RFP"), { kind: "RFP", typeLabel: null }, "bare RFP");
eq(classifyKind("RFQ (GESA)"), { kind: "RFQ", typeLabel: "RFQ (GESA)" }, "GESA RFQ keeps its label");
eq(classifyKind("IFB (IDIQ)"), { kind: "IFB", typeLabel: "IFB (IDIQ)" }, "IDIQ bid");
eq(classifyKind("Trade bid (sub to CM)"), { kind: "IFB", typeLabel: "Trade bid (sub to CM)" }, "trade bid is an IFB");
eq(classifyKind("ITQ / prequal"), { kind: "OTHER", typeLabel: "ITQ / prequal" }, "prequal is other");
eq(classifyKind("meeting minutes"), { kind: "MEETING_MINUTES", typeLabel: null }, "meeting minutes");

eq(parseEstimate("Not stated"), null, "not stated is not a number");
eq(parseEstimate("GC $11M–$12M (HVAC $12M–$13M)"), null, "a range is not turned into one number");
eq(parseEstimate("Up to $12M bonds"), null, "a ceiling is not turned into one number");
eq(parseEstimate("About $50M (certificates of participation)"), 50_000_000, "about $50M");
eq(parseEstimate("~$29M expiring 2027"), 29_000_000, "~$29M");
eq(parseEstimate("$39.2M construction"), 39_200_000, "$39.2M");
eq(parseEstimate("$1,250,000"), 1_250_000, "dollars with commas");
eq(parseEstimate("GC $4M; HVAC $2M"), null, "two figures stay as text");

eq(parseWhen("2026-12-08 14:00").at?.toISOString(), "2026-12-08T14:00:00.000Z", "due date keeps the clock time");
eq(parseWhen("2026-11-06 (held)"), { at: new Date("2026-11-06T00:00:00.000Z"), rest: "held" }, "pre-bid held");
eq(parseWhen("2026-11-30 13:00, Fort Indiantown Gap").rest, "Fort Indiantown Gap", "pre-bid place is kept");

eq(canonicalCompanies(["PERF", "QCG", "PERF"]), { codes: ["PCS", "QCG"] }, "PERF is Performance (PCS), once, lead first");
eq("error" in canonicalCompanies(["NOPE"]), true, "unknown company is rejected");

eq(orgMatchKey("PA Dept. of General Services"), orgMatchKey("Pennsylvania Department of General Services"), "DGS abbreviations match");
eq(namesMatch("City of Pottsville (RACP itemizations)", "City of Pottsville"), true, "parenthetical sourcing notes are ignored");
eq(namesMatch("Lincoln University (via DGS)", "Lincoln University"), true, "via-agency parenthetical is ignored");
eq(namesMatch("Beaver County Housing Authority", "Housing Authority of the County of Beaver"), false, "different word order is not treated as the same owner");

eq(inferOrgType("PA Dept. of General Services"), { value: "state agency", confirm: false }, "a department is a state agency");
eq(inferOrgType("Housing Authority of the County of Beaver").value, "housing authority", "housing authority from the name");
eq(inferOrgType("Mystery Owner").confirm, true, "an unknown owner type is marked [confirm]");
eq(inferPursuit({ kind: "RFQ", typeLabel: "RFQ (GESA)", title: "Energy project", why: null, valueText: null }).deliveryMethod, "GESA_EPC", "GESA sets the delivery method");
eq(inferPursuit({ kind: "IFB", typeLabel: null, title: "Clarifier replacement", why: "WWTP upgrade", valueText: null }).projectType, "water/wastewater", "wastewater from the text");
eq(inferPursuit({ kind: "RFP", typeLabel: null, title: "Office renovation", why: "Near HQ", valueText: null }), { projectType: null, deliveryMethod: null }, "a plain renovation is not given a guessed type");

// ── the attached tracker ────────────────────────────────────────────────────
const tracker = JSON.parse(readFileSync(path.join(process.cwd(), "data", "bid_feed_tracker.json"), "utf8"));
const batch = trackerToBatch(tracker);
if (!batch.ok) {
  console.log("FAIL tracker did not parse", batch.error);
  process.exit(1);
}
eq(batch.errors, [], "tracker rows all validate");
eq(batch.items.length, 72, "50 solicitations + 22 meeting-minute leads");
eq(batch.items.filter((i) => i.kind === "MEETING_MINUTES").length, 22, "leads are meeting-minute items");
const bridge = batch.items.find((i) => i.title.startsWith("Bundled P3"));
eq(bridge && { codes: bridge.companyCodes, value: bridge.estimatedValue, url: bridge.sourceUrl }, { codes: ["PCS", "QCG"], value: 50_000_000, url: bridge?.sourceUrl ?? null }, "P3 bridge lead: PERF→PCS lead, QCG support, $50M");
const internal = batch.items.find((i) => i.externalKey.startsWith("internal:"));
eq(internal && { sourceUrl: internal.sourceUrl, sourceName: internal.sourceName, notes: (internal.notes ?? "").includes("internal:") }, { sourceUrl: null, sourceName: "Internal notes", notes: true }, "an internal reference is not stored as a link");
const range = batch.items.find((i) => i.title.startsWith("Rachel Carson"));
eq(range ? range.estimatedValue : "missing", null, "Rachel Carson range stays text");
eq(range?.valueText?.includes("$11M") ?? false, true, "Rachel Carson value text is kept");
eq(new Set(batch.items.map((i) => i.externalKey)).size, 72, "tracker keys are unique");

const bad = parseBidFeedBatch({ items: [{ title: "No key" }, { externalKey: "k", title: "T", ownerName: "O", type: "RFP", companies: ["ZZZ"], priority: "High" }] });
eq(bad.ok && bad.errors.map((e) => e.index), [0, 1], "invalid items are reported and not mixed into the saved set");
eq(parseBidFeedBatch({ nope: [] }).ok, false, "a body without items is rejected");
eq(parseBidFeedBatch([]).ok, false, "a bare array is rejected");

if (fail) process.exit(1);

// ── intake endpoint and approve flow, against a throwaway database ─────────
async function integration() {
  const { execSync } = await import("node:child_process");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(path.join(tmpdir(), "bidfeed-"));
  const url = `file:${path.join(dir, "test.db")}`;
  process.env.DATABASE_URL = url;
  process.env.BID_FEED_SECRET = "test-bid-secret";
  const env = { ...process.env, DATABASE_URL: url, BID_FEED_SECRET: "test-bid-secret" };
  execSync("npx prisma migrate deploy", { cwd: process.cwd(), stdio: "inherit", env });

  const { POST } = await import("../app/api/bid-feed/intake/route");
  const { prisma } = await import("../lib/db");
  const { approveBidFeedItem, setBidFeedStatus } = await import("../lib/bidFeed/store");

  const post = (authorization: string | null, body: unknown) =>
    POST(new Request("http://localhost/api/bid-feed/intake", {
      method: "POST",
      headers: { ...(authorization ? { authorization } : {}), "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }));

  const unauth = await post(null, { items: [] });
  eq(unauth.status, 401, "intake without a secret is 401");
  const wrong = await post("Bearer no", { items: [] });
  eq(wrong.status, 401, "intake with the wrong secret is 401");
  const badJson = await post("Bearer test-bid-secret", "{");
  eq(badJson.status, 400, "intake with invalid JSON is 400");
  const badShape = await post("Bearer test-bid-secret", { items: "no" });
  eq(badShape.status, 400, "intake without an items array is 400");

  for (const code of ["QCG", "QES", "PCS", "JVS", "PYR", "ENT"]) {
    await prisma.company.create({ data: { code, name: code } });
  }
  const lead = await prisma.user.create({ data: { email: "lead@quandel.test", name: "BD Lead", role: "BD_LEAD" } });
  const trainee = await prisma.user.create({ data: { email: "trainee@quandel.test", role: "TRAINEE" } });

  const item = {
    externalKey: "https://example.test/rfp-1",
    title: "Example office renovation",
    ownerName: "PA Dept. of General Services",
    county: "Dauphin",
    type: "RFP",
    companies: ["QCG", "PYR"],
    value: "About $4.5M",
    due: "2026-12-08 14:00",
    pre_bid: "2026-11-06 (held)",
    url: "https://example.test/rfp-1",
    source: "Example source",
    priority: "High",
    why: "Near HQ",
  };
  const first = await post("Bearer test-bid-secret", { items: [item, { title: "missing" }] });
  const firstBody = await first.json() as { created: number; updated: number; errors: { index: number }[] };
  eq(first.status, 200, "a valid batch is accepted");
  eq([firstBody.created, firstBody.updated, firstBody.errors.map((e) => e.index)], [1, 0, [1]], "one created, the broken item reported");

  const again = await post("Bearer test-bid-secret", { items: [{ ...item, title: "Example office renovation (updated)", priority: "Medium" }] });
  const againBody = await again.json() as { created: number; updated: number };
  eq([againBody.created, againBody.updated, await prisma.bidFeedItem.count({ where: { externalKey: item.externalKey } })], [0, 1, 1], "re-posting the same key updates; it does not duplicate");
  const row = await prisma.bidFeedItem.findUnique({ where: { externalKey: item.externalKey }, include: { leadCompany: true, companies: true } });
  eq(row?.title, "Example office renovation (updated)", "title updated");
  eq(row?.priority, "MEDIUM", "priority updated");
  eq(row?.status, "NEW", "status stays new");
  eq(row?.leadCompany?.code, "QCG", "first company is the lead");
  eq(row?.companies.map((c) => c.code).sort(), ["PYR", "QCG"].sort(), "both companies are tagged");
  eq(row?.estimatedValue == null ? null : Number(row.estimatedValue), 4_500_000, "single published figure is stored");
  eq(row?.dueAt?.toISOString(), "2026-12-08T14:00:00.000Z", "due date stored");
  eq(row?.preBidText, "held", "pre-bid note stored");
  const seen = row!.firstSeenAt.getTime();

  await setBidFeedStatus(row!.id, "DISMISSED", lead.role);
  const afterDismiss = await post("Bearer test-bid-secret", { items: [{ ...item, title: "Posted again after dismiss" }] });
  const dismissBody = await afterDismiss.json() as { updated: number };
  const dismissed = await prisma.bidFeedItem.findUnique({ where: { id: row!.id } });
  eq([dismissBody.updated, dismissed?.status, dismissed?.title, dismissed?.firstSeenAt.getTime()], [1, "DISMISSED", "Posted again after dismiss", seen], "a re-post does not reopen a dismissed item or move first-seen");

  const restored = await setBidFeedStatus(row!.id, "NEW", trainee.role);
  eq(restored.ok, false, "a trainee cannot restore");
  eq((await setBidFeedStatus(row!.id, "NEW", lead.role)).ok, true, "dismiss is reversible");
  eq((await prisma.bidFeedItem.findUnique({ where: { id: row!.id } }))?.status, "NEW", "restored to new");

  const denied = await approveBidFeedItem(row!.id, trainee);
  eq(denied.ok, false, "a trainee cannot approve");

  const existing = await prisma.organization.create({
    data: { name: "Pennsylvania Department of General Services", orgType: "state agency", state: "PA", county: "Dauphin", source: "test" },
  });
  const before = Date.now();
  const approved = await approveBidFeedItem(row!.id, lead);
  if (!approved.ok) {
    eq(approved, { ok: true }, "approve succeeds");
  } else {
    eq(approved.createdOrg, false, "approve matches the existing DGS organization");
    eq(approved.orgId, existing.id, "the matched organization is the one already on file");
    const opp = await prisma.opportunity.findUnique({
      where: { id: approved.opportunityId },
      include: { leadCompany: true, supportCompanies: true, stageChanges: true, org: { include: { companies: true } } },
    });
    eq(opp?.stage, 1, "opportunity opens at stage 1");
    eq(opp && opp.stageEnteredAt.getTime() >= before && opp.stageEnteredAt.getTime() <= Date.now() + 1000, true, "stageEnteredAt is recorded");
    eq(opp?.leadCompany.code, "QCG", "lead company from the feed");
    eq(opp?.supportCompanies.map((c) => c.code), ["PYR"], "the other company supports");
    eq(opp?.orgId, existing.id, "opportunity is on the matched owner");
    eq(opp?.estimatedValue == null ? null : Number(opp.estimatedValue), 4_500_000, "estimated value copied when the text states one figure");
    eq(opp?.dueDate?.toISOString(), "2026-12-08T14:00:00.000Z", "bid date copied");
    eq(opp?.stageChanges[0]?.toStage, 1, "stage history starts at 1");
    eq((opp?.stageChanges[0]?.note ?? "").includes("https://example.test/rfp-1"), true, "source link is in the creation note");
    eq(opp?.org.companies.map((c) => c.code).sort(), ["PYR", "QCG"].sort(), "the owner keeps the company tags");
    const linked = await prisma.bidFeedItem.findUnique({ where: { id: row!.id } });
    eq([linked?.status, linked?.opportunityId], ["APPROVED", opp?.id], "the feed item is approved and linked");
    const second = await approveBidFeedItem(row!.id, lead);
    eq(second.ok, false, "approving again does not open a second opportunity");
    eq(await prisma.opportunity.count(), 1, "still one opportunity");
  }

  // A range does not become an estimated value on the opportunity.
  const rangePost = await post("Bearer test-bid-secret", {
    items: [{
      externalKey: "https://example.test/range",
      title: "Range example",
      ownerName: "Example Borough",
      county: "Lebanon",
      type: "IFB",
      companies: ["PYR"],
      value: "GC $4M–$5M",
      priority: "Low",
      source: "Example",
      url: "https://example.test/range",
    }],
  });
  eq((await rangePost.json() as { created: number }).created, 1, "range item saved");
  const rangeRow = await prisma.bidFeedItem.findUnique({ where: { externalKey: "https://example.test/range" } });
  eq(rangeRow?.estimatedValue, null, "range has no numeric estimate");
  const rangeOpp = await approveBidFeedItem(rangeRow!.id, lead);
  if (rangeOpp.ok) {
    const o = await prisma.opportunity.findUnique({ where: { id: rangeOpp.opportunityId } });
    eq(o?.estimatedValue, null, "approving a range does not invent a dollar amount");
    eq(o?.stage, 1, "range item also opens at stage 1");
    eq(rangeOpp.createdOrg, true, "a new owner is created when none matches");
    const org = await prisma.organization.findUnique({ where: { id: rangeOpp.orgId } });
    eq(org?.orgType, "borough", "borough taken from the name");
    eq((org?.notes ?? "").includes("[confirm]"), false, "a recognized type is not marked confirm");
  } else eq(rangeOpp.ok, true, "range item approves");

  await prisma.$disconnect();
  execSync("npx tsx scripts/import-bid-feed.ts", { cwd: process.cwd(), stdio: "pipe", env });
  eq(await prisma.bidFeedItem.count(), 74, "tracker import adds the 72 rows beside the two examples");
  const secondImport = execSync("npx tsx scripts/import-bid-feed.ts", { cwd: process.cwd(), stdio: "pipe", env }).toString();
  eq(/Created 0, updated 72/.test(secondImport), true, "running the import again updates instead of duplicating");
  eq(await prisma.bidFeedItem.count(), 74, "still 74 rows after the second import");
  const imported = await prisma.bidFeedItem.findFirst({ where: { externalKey: { startsWith: "internal:" } } });
  eq(imported?.status, "NEW", "imported leads start as new");

  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
}

integration().then(() => {
  if (fail) process.exit(1);
  console.log("bid feed tests passed");
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
