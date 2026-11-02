// Table exports (SPEC §11: "Export any table to Excel/CSV").
import type { Role } from "@prisma/client";
import { openFlags } from "./complianceData";
import { prisma } from "./db";
import { canFacilitate, canReviewCompliance } from "./permissions";
import { deliveryLabel, stageName, weightedValue } from "./pipeline";
import { learnerSessions } from "./training/progress";

type Row = Record<string, string | number | boolean | null>;
type Table = { title: string; allowed?: (r: Role) => boolean; rows: () => Promise<Row[]> };

const d = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : null);
const n = (x: unknown) => (x == null ? null : Number(x));
const codes = (cs: { code: string }[]) => cs.map((c) => c.code).join(" ");

export const EXPORTS: Record<string, Table> = {
  organizations: {
    title: "Organizations",
    rows: async () => (await prisma.organization.findMany({ include: { companies: true, relationshipOwner: true }, orderBy: { name: "asc" } })).map((o) => ({
      Name: o.name, Type: o.orgType, State: o.state, County: o.county, Region: o.region, Tier: o.tier, Status: o.status, Companies: codes(o.companies),
      "Relationship owner": o.relationshipOwner?.name ?? o.relationshipOwner?.email ?? null, "Quandel territory": o.quandelTerritory, "ARC county": o.arcCounty,
      "Fiscal stress": o.fiscalStressStatus, Population: o.population, Enrollment: o.enrollment, "Annual budget": n(o.annualBudget), "Debt outstanding": n(o.debtOutstanding),
      Buildings: o.buildingCount, "Oldest building": o.oldestBuildingYear, "Last energy project": o.lastEnergyProjectYear, "Last ESCO": o.lastEnergyProjectEsco,
      "Governing body": o.governingBody, Website: o.website, Source: o.source, Notes: o.notes,
    })),
  },
  contacts: {
    title: "Contacts",
    rows: async () => (await prisma.contact.findMany({ include: { org: true }, orderBy: { name: "asc" } })).map((c) => ({
      Name: c.name, Title: c.title, Organization: c.org.name, State: c.org.state, "Decision role": c.decisionRole, Function: c.function, Strength: c.relationshipStrength,
      Email: c.email, Phone: c.phone, "Last touch": d(c.lastTouch), "Next touch": d(c.nextTouch), "Do not contact": c.doNotContact, "Opted out": c.optOut,
    })),
  },
  activities: {
    title: "Activities",
    rows: async () => (await prisma.activity.findMany({ include: { org: true, contacts: true, companies: true, opportunity: true, createdBy: true, financialAdvisorContact: true }, orderBy: { occurredAt: "desc" } })).map((a) => ({
      Date: d(a.occurredAt), Type: a.type, Organization: a.org.name, Contacts: a.contacts.map((c) => c.name).join("; "), Companies: codes(a.companies), Opportunity: a.opportunity?.name ?? null,
      Notes: a.notes, "Next step": a.nextStep, "Next step date": d(a.nextStepDate), "Next step done": a.nextStepDone, "Financing discussed": a.financingDiscussed,
      "Financial advisor": a.financialAdvisorContact?.name ?? null, "Logged by": a.createdBy?.name ?? a.createdBy?.email ?? null,
    })),
  },
  opportunities: {
    title: "Opportunities",
    rows: async () => (await prisma.opportunity.findMany({ include: { org: true, leadCompany: true, supportCompanies: true, owner: true, rivalCompetitors: true, lostTo: true }, orderBy: [{ stage: "asc" }, { name: "asc" }] })).map((o) => ({
      Name: o.name, Owner: o.org.name, State: o.org.state, "Lead company": o.leadCompany.code, "Support companies": codes(o.supportCompanies), Stage: `${o.stage} ${stageName(o.stage)}`,
      "Delivery method": deliveryLabel(o.deliveryMethod), "Project type": o.projectType, "Estimated value": n(o.estimatedValue), "Quandel scope": n(o.quandelScopeValue),
      Probability: o.probability, Weighted: Math.round(weightedValue(o)), "Go/no-go": o.goNoGo, Outcome: o.outcome, "Lost to": o.lostTo?.name ?? null,
      Competitors: [...o.rivalCompetitors.map((c) => c.name), o.competitors].filter(Boolean).join("; "), "Due date": d(o.dueDate), "Award date": d(o.awardDate),
      "Pursuit owner": o.owner?.name ?? o.owner?.email ?? null,
    })),
  },
  programs: {
    title: "Funding programs",
    rows: async () => (await prisma.fundingProgram.findMany({ orderBy: [{ jurisdiction: "asc" }, { name: "asc" }] })).map((p) => ({
      Program: p.name, Jurisdiction: p.jurisdiction, Agency: p.agency, Type: p.programType, "Min award": n(p.minAward), "Max award": n(p.maxAward), "Match %": n(p.matchPct),
      "Match basis": p.matchBasis, Reimbursement: p.reimbursement, Cycle: p.cycle, "Next deadline": d(p.nextDeadline), URL: p.url, Source: p.source, "Last verified": d(p.lastVerifiedAt),
    })),
  },
  "capital-stacks": {
    title: "Capital stacks",
    rows: async () => (await prisma.capitalStackRow.findMany({ include: { opportunity: { include: { org: true } }, program: true }, orderBy: [{ opportunityId: "asc" }, { sortOrder: "asc" }] })).map((r) => ({
      Opportunity: r.opportunity.name, Owner: r.opportunity.org.name, Source: r.program?.name ?? r.label ?? r.otherSource, Program: !!r.program, Amount: n(r.amount), Status: r.status,
      Applied: d(r.applicationDate), Awarded: d(r.awardDate), "Reimbursement lag (days)": r.reimbursementLagDays,
    })),
  },
  projects: {
    title: "Projects",
    rows: async () => (await prisma.project.findMany({ include: { org: true, companies: true, referenceContact: true }, orderBy: { name: "asc" } })).map((p) => ({
      Project: p.name, Owner: p.org.name, "Owner type": p.org.orgType, State: p.org.state, Companies: codes(p.companies), "Project type": p.projectType, "Delivery method": deliveryLabel(p.deliveryMethod),
      Value: n(p.value), Status: p.status, "Completion year": p.completionYear, Reference: p.referenceContact?.name ?? null, Results: p.results, "Savings achieved": n(p.annualSavingsAchieved),
    })),
  },
  "competitor-projects": {
    title: "Competitor projects",
    rows: async () => (await prisma.competitorProject.findMany({ include: { competitor: true, org: true }, orderBy: [{ competitorId: "asc" }, { ownerName: "asc" }] })).map((p) => ({
      Competitor: p.competitor.name, Owner: p.ownerName, "CRM organization": p.org?.name ?? null, County: p.county, State: p.state, Category: p.category, What: p.description, When: p.when, Value: n(p.value), Source: p.sourceUrl ?? p.sourceTitle,
    })),
  },
  bridges: {
    title: "Bridges",
    rows: async () => (await prisma.bridge.findMany({ include: { bundles: { include: { bundle: true } } }, orderBy: [{ county: "asc" }, { name: "asc" }] })).map((b) => ({
      Bridge: b.name, County: b.county, State: b.state, "Year built": b.yearBuilt, "Vehicles/day": b.adt, "Route type": b.routeType, Owner: b.ownerName, "Owner verified": b.ownerVerified,
      Condition: b.condition, Type: b.bridgeType, "Length (ft)": n(b.lengthFt), "Width (ft)": n(b.widthFt), Bundles: b.bundles.map((x) => x.bundle.name).join("; "), Source: b.source,
    })),
  },
  gifts: {
    title: "Gifts and hospitality",
    allowed: canReviewCompliance,
    rows: async () => (await prisma.giftEntry.findMany({ include: { giver: true, approver: true, reviewedBy: true, org: true }, orderBy: { date: "desc" } })).map((g) => ({
      Date: d(g.date), Kind: g.kind, Description: g.description, Value: n(g.value), Jurisdiction: g.state, Recipient: g.recipientName, Organization: g.org?.name ?? null,
      "Given by": g.giver.name ?? g.giver.email, "Approved by": g.approver?.name ?? g.approver?.email ?? null, Reviewed: d(g.reviewedAt), "Reviewed by": g.reviewedBy?.name ?? null, "Review note": g.reviewNote,
    })),
  },
  lobbying: {
    title: "Lobbying",
    allowed: canReviewCompliance,
    rows: async () => (await prisma.lobbyingEntry.findMany({ include: { user: true }, orderBy: { date: "desc" } })).map((l) => ({
      Date: d(l.date), Jurisdiction: l.jurisdiction, Hours: n(l.hours), "Compensation + expenses": n(l.expenses), Subject: l.subject, Officials: l.officials, By: l.user.name ?? l.user.email, Notes: l.notes,
    })),
  },
  financing: {
    title: "Municipal-advisor log",
    rows: async () => (await prisma.activity.findMany({ where: { financingDiscussed: true }, include: { org: true, financialAdvisorContact: true, createdBy: true }, orderBy: { occurredAt: "desc" } })).map((a) => ({
      Date: d(a.occurredAt), Owner: a.org.name, Type: a.type, Notes: a.notes, "Financial advisor": a.financialAdvisorContact?.name ?? null, "Logged by": a.createdBy?.name ?? a.createdBy?.email ?? null,
    })),
  },
  flags: { title: "Compliance flags", rows: async () => (await openFlags()).map((f) => ({ Level: f.level === "bad" ? "Stop" : "Check", Kind: f.kind, Flag: f.text, Where: f.where })) },
  training: {
    title: "Training gradebook",
    allowed: canFacilitate,
    rows: async () => {
      const people = await prisma.user.findMany({ where: { active: true }, include: { companies: true }, orderBy: { name: "asc" } });
      const out: Row[] = [];
      for (const p of people) for (const s of await learnerSessions(p.id))
        out.push({ Person: p.name ?? p.email, Companies: codes(p.companies), Edition: s.editionCode, Session: s.code, Title: s.title, Deck: s.parts.deck, Quiz: s.parts.quiz, "Best quiz %": s.bestScore, Deliverable: s.parts.deliverable, Complete: s.parts.complete, Due: d(s.dueDate) });
      return out;
    },
  },
};

/** Spreadsheet apps run cells that start with = + - @ as formulas; prefix them so data stays data. */
export const safeCell = (v: unknown): string | number | boolean | null => {
  if (v == null || typeof v === "number" || typeof v === "boolean") return v as never;
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

export function toCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(safeCell(v));
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.map(esc).join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
}
