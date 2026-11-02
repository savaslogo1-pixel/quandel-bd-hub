// Dashboard figures (SPEC §11). Server-only queries; every figure links back to a list.
import { bundleEstimate } from "./bridges";
import { openFlags, lobbyingTotals } from "./complianceData";
import { prisma } from "./db";
import { energyModel } from "./energy";
import { addDays } from "./meetings";
import { todayUTC } from "./format";
import { checklistFor, weightedValue } from "./pipeline";
import { learnerSessions } from "./training/progress";

const num = (v: unknown) => (v == null ? null : Number(v));

export async function pipelineData() {
  const opps = await prisma.opportunity.findMany({
    include: { org: { select: { id: true, name: true, state: true, orgType: true } }, leadCompany: true, supportCompanies: true, checklist: true, measures: true },
  });
  return opps.map((o) => ({ ...o, weighted: weightedValue(o), codes: [o.leadCompany.code, ...o.supportCompanies.map((c) => c.code)] }));
}
export type PipeOpp = Awaited<ReturnType<typeof pipelineData>>[number];

export function winRates(opps: PipeOpp[]) {
  const m = new Map<string, { won: number; lost: number }>();
  for (const o of opps) {
    if (o.outcome !== "WON" && o.outcome !== "LOST") continue;
    const k = o.deliveryMethod ?? "NONE";
    const e = m.get(k) ?? { won: 0, lost: 0 };
    o.outcome === "WON" ? e.won++ : e.lost++;
    m.set(k, e);
  }
  return [...m].map(([dm, v]) => ({ dm, ...v, rate: v.won / (v.won + v.lost) }));
}

export async function fundingData() {
  const rows = await prisma.capitalStackRow.findMany({ where: { programId: { not: null } }, include: { program: true, opportunity: { select: { id: true, name: true, stage: true } } } });
  const sum = (f: (s: string) => boolean) => rows.filter((r) => f(r.status)).reduce((a, r) => a + (num(r.amount) ?? 0), 0);
  const today = todayUTC();
  const soon = rows
    .filter((r) => r.program!.nextDeadline && r.program!.nextDeadline >= today && r.program!.nextDeadline <= addDays(today, 90) && (r.status === "IDEA" || r.status === "APPLIED") && r.opportunity.stage < 9)
    .sort((a, b) => a.program!.nextDeadline!.getTime() - b.program!.nextDeadline!.getTime());
  return { planned: sum((s) => s === "IDEA"), applied: sum((s) => s === "APPLIED"), awarded: sum((s) => s === "AWARDED" || s === "CLOSED"), denied: sum((s) => s === "DENIED"), soon };
}

/** Coverage (SPEC §11): Tier A targets with a decision map (a contact with a decision role) and a touch in the last 60 days. */
export async function coverageData() {
  const since = addDays(todayUTC(), -60);
  const orgs = await prisma.organization.findMany({
    where: { tier: "A" },
    select: { id: true, name: true, county: true, companies: { select: { code: true } }, relationshipOwner: { select: { name: true, email: true } }, contacts: { where: { decisionRole: { not: null } }, select: { id: true } }, activities: { where: { occurredAt: { gte: since } }, select: { id: true } } },
    orderBy: { name: "asc" },
  });
  const rows = orgs.map((o) => ({ ...o, mapped: o.contacts.length > 0, touched: o.activities.length > 0 }));
  return { total: rows.length, covered: rows.filter((r) => r.mapped && r.touched).length, mapped: rows.filter((r) => r.mapped).length, touched: rows.filter((r) => r.touched).length, gaps: rows.filter((r) => !(r.mapped && r.touched)) };
}

export async function trainingData() {
  const [people, waiting, attempts] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, include: { companies: true } }),
    prisma.deliverableSubmission.count({ where: { status: "SUBMITTED" } }),
    prisma.quizAttempt.aggregate({ _avg: { scorePct: true }, _count: true }),
  ]);
  const views = await Promise.all(people.map(async (p) => ({ p, v: await learnerSessions(p.id) })));
  const byCompany = new Map<string, { people: number; done: number; total: number }>();
  for (const { p, v } of views) {
    const done = v.filter((x) => x.parts.complete).length;
    for (const c of p.companies.length ? p.companies.map((c) => c.code) : ["(none)"]) {
      const e = byCompany.get(c) ?? { people: 0, done: 0, total: 0 };
      e.people++; e.done += done; e.total += v.length;
      byCompany.set(c, e);
    }
  }
  return { byCompany, waiting, quizAvg: attempts._avg.scorePct, attempts: attempts._count };
}

export async function complianceData() {
  const [flags, lob] = await Promise.all([openFlags(), lobbyingTotals(new Date().getUTCFullYear())]);
  return { stop: flags.filter((f) => f.level === "bad").length, check: flags.filter((f) => f.level === "warn").length, flags, lob };
}

/* ───── company-specific ───── */

export function qesFigures(opps: PipeOpp[]) {
  const qes = opps.filter((o) => o.codes.includes("QES"));
  const energy = qes.filter((o) => o.deliveryMethod === "GESA_EPC" || o.deliveryMethod === "HUD_EPC");
  const auditsInProgress = energy.filter((o) => {
    const done = new Set(o.checklist.map((c) => c.itemKey));
    return o.stage < 9 && done.has("audit_agreement") && !done.has("iga");
  });
  const guaranteed = (o: PipeOpp) =>
    num(o.guaranteedSavingsOverride) ?? energyModel({ measures: o.measures.map((m) => ({ name: m.name, cost: num(m.cost), annualSavings: num(m.annualSavings), electivePayAmount: num(m.electivePayAmount) })), nonEnergyCost: null, otherFunding: null, ratePct: null, termYears: null, guaranteedOverride: null, framework: null, isSchool: false, rules: { paCostTestYears: null, paNonEnergyCapPct: null, paPublicNoticeDays: null, nyMaxTermYears: null, nySchoolPaybackYears: null, hudMaxTermYears: null } }).measureSavings;
  const underManagement = energy.filter((o) => o.outcome === "WON" || o.stage === 10);
  return { qes, energy, auditsInProgress, underManagement, savingsUnderManagement: underManagement.reduce((a, o) => a + guaranteed(o), 0) };
}

export async function mvDue() {
  const today = todayUTC();
  return prisma.mvReport.findMany({ where: { status: "DUE", dueDate: { lte: addDays(today, 60) } }, include: { opportunity: { select: { id: true, name: true, org: { select: { name: true } } } } }, orderBy: { dueDate: "asc" } });
}

export async function bundlesData() {
  const bundles = await prisma.bridgeBundle.findMany({ include: { bridges: { include: { bridge: true } }, opportunity: { select: { id: true, name: true, stage: true } } }, orderBy: { updatedAt: "desc" } });
  return bundles.map((b) => ({
    ...b,
    est: bundleEstimate(b.bridges.map((x) => ({ id: x.id, name: x.bridge.name, county: x.bridge.county, bridgeType: x.bridge.bridgeType, estimate: num(x.estimate), lengthFt: num(x.bridge.lengthFt), widthFt: num(x.bridge.widthFt) })), { unitCostPerSqFt: num(b.unitCostPerSqFt), designPct: num(b.designPct), cmPct: num(b.cmPct), contingencyPct: num(b.contingencyPct) }),
  }));
}

export const upcoming = (opps: PipeOpp[], field: "preBidDate" | "dueDate" | "interviewDate", days = 90) => {
  const t = todayUTC(), end = addDays(t, days);
  return opps.filter((o) => o[field] && o[field]! >= t && o[field]! <= end).sort((a, b) => a[field]!.getTime() - b[field]!.getTime());
};
export const checklistDone = (o: PipeOpp) => {
  const cl = checklistFor(o.deliveryMethod);
  return cl ? `${cl.items.filter((i) => o.checklist.some((c) => c.itemKey === i.key)).length}/${cl.items.length}` : null;
};
