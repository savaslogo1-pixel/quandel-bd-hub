import { prisma } from "./db";
import { addDays, meetingsBetween, parsePattern } from "./meetings";

export type CalType = "grant" | "bid" | "board" | "approval" | "next" | "training";
export const CAL_TYPES: Record<CalType, { label: string; color: string }> = {
  grant: { label: "Grant deadline", color: "#c99400" },
  bid: { label: "Bid / procurement date", color: "var(--brand)" },
  board: { label: "Board meeting", color: "#7b4fb0" },
  approval: { label: "Approval step", color: "#0e8a8a" },
  next: { label: "Next step", color: "var(--ok)" },
  training: { label: "Training", color: "#b5651d" },
};

export type CalEvent = { date: Date; type: CalType; title: string; sub: string; href: string; companies: string[] };

const KEY_DATES = [
  ["rfqIssueDate", "RFQ/RFP issue"], ["preBidDate", "Pre-bid"], ["dueDate", "Due"], ["interviewDate", "Interview"],
  ["boardVoteDate", "Board vote"], ["awardDate", "Award"], ["constructionStartDate", "Construction start"], ["substantialCompletionDate", "Substantial completion"],
] as const;

/**
 * One calendar (SPEC §6): grant deadlines, bid dates, board meetings, approval steps and next steps.
 * Board meetings are listed for Tier A organizations and organizations with open opportunities.
 * Training: capstone dates and training due dates (assignments to the person or their companies when "mine").
 */
export async function calendarEvents(from: Date, to: Date, opts: { userId?: string } = {}): Promise<CalEvent[]> {
  const inRange = { gte: from, lte: to };
  const mineOpp = opts.userId ? { OR: [{ ownerId: opts.userId }, { createdById: opts.userId }] } : {};
  const me = opts.userId ? await prisma.user.findUnique({ where: { id: opts.userId }, select: { companies: { select: { id: true } } } }) : null;
  const [programs, opps, steps, orgs, acts, capstones, assignments] = await Promise.all([
    prisma.fundingProgram.findMany({
      where: { nextDeadline: inRange, ...(opts.userId ? { stackRows: { some: { opportunity: mineOpp } } } : {}) },
      select: { id: true, name: true, jurisdiction: true, nextDeadline: true },
    }),
    prisma.opportunity.findMany({
      where: { ...mineOpp, OR: KEY_DATES.map(([k]) => ({ [k]: inRange })) },
      include: { org: { select: { name: true } }, leadCompany: { select: { code: true } }, supportCompanies: { select: { code: true } } },
    }),
    prisma.approvalStep.findMany({
      where: { meetingDate: inRange, status: { not: "DONE" }, opportunity: mineOpp },
      include: { opportunity: { select: { id: true, name: true, org: { select: { name: true } }, leadCompany: { select: { code: true } }, supportCompanies: { select: { code: true } } } } },
    }),
    prisma.organization.findMany({
      where: {
        meetingWeekday: { not: null },
        ...(opts.userId ? { relationshipOwnerId: opts.userId } : { OR: [{ tier: "A" }, { opportunities: { some: { stage: { lt: 9 } } } }] }),
      },
      select: { id: true, name: true, governingBody: true, meetingWeekday: true, meetingWeeksOfMonth: true, agendaDeadlineDays: true, companies: { select: { code: true } } },
    }),
    prisma.activity.findMany({
      where: { nextStepDate: inRange, nextStepDone: false, nextStep: { not: null }, ...(opts.userId ? { createdById: opts.userId } : {}) },
      include: { org: { select: { name: true } }, companies: { select: { code: true } } },
    }),
    prisma.capstoneEvent.findMany({ where: { scheduledAt: inRange }, include: { edition: true } }),
    prisma.trainingAssignment.findMany({
      where: { dueDate: inRange, ...(opts.userId ? { OR: [{ userId: opts.userId }, { companyId: { in: (me?.companies ?? []).map((c) => c.id) } }] } : {}) },
      include: { session: { include: { edition: true } }, edition: true, user: { select: { name: true, email: true } }, company: { select: { code: true } } },
    }),
  ]);
  const ev: CalEvent[] = [];
  for (const p of programs) ev.push({ date: p.nextDeadline!, type: "grant", title: `${p.name} deadline`, sub: p.jurisdiction, href: `/programs/${p.id}`, companies: [] });
  for (const o of opps) {
    const cos = [o.leadCompany.code, ...o.supportCompanies.map((c) => c.code)];
    for (const [k, label] of KEY_DATES) {
      const d = o[k];
      if (d && d >= from && d <= to) ev.push({ date: d, type: "bid", title: `${label}: ${o.name}`, sub: o.org.name, href: `/opportunities/${o.id}`, companies: cos });
    }
  }
  for (const s of steps) {
    const cos = [s.opportunity.leadCompany.code, ...s.opportunity.supportCompanies.map((c) => c.code)];
    ev.push({ date: s.meetingDate!, type: "approval", title: s.label, sub: `${s.opportunity.name} · ${s.opportunity.org.name}`, href: `/opportunities/${s.opportunity.id}?tab=approvals`, companies: cos });
    if (s.agendaDeadline && s.agendaDeadline >= from && s.agendaDeadline <= to)
      ev.push({ date: s.agendaDeadline, type: "approval", title: `Agenda deadline: ${s.label}`, sub: `${s.opportunity.name} · ${s.opportunity.org.name}`, href: `/opportunities/${s.opportunity.id}?tab=approvals`, companies: cos });
  }
  for (const o of orgs) {
    for (const d of meetingsBetween(parsePattern(o.meetingWeekday, o.meetingWeeksOfMonth), from, to))
      ev.push({ date: d, type: "board", title: `${o.governingBody ?? "Board"} meeting`, sub: o.agendaDeadlineDays != null ? `${o.name} · agenda closes ${addDays(d, -o.agendaDeadlineDays).toISOString().slice(5, 10).replace("-", "/")}` : o.name, href: `/organizations/${o.id}?tab=map`, companies: o.companies.map((c) => c.code) });
  }
  for (const a of acts) ev.push({ date: a.nextStepDate!, type: "next", title: a.nextStep!, sub: a.org.name, href: `/activities/${a.id}`, companies: a.companies.map((c) => c.code) });
  for (const c of capstones) ev.push({ date: c.scheduledAt!, type: "training", title: `Capstone: ${c.title}`, sub: `${c.edition.title} edition`, href: "/training/capstone", companies: [] });
  for (const a of assignments) {
    const what = a.session ? `${a.session.edition.code} Session ${a.session.code}: ${a.session.title}` : `${a.edition?.title} edition`;
    const who = a.user ? a.user.name ?? a.user.email : a.company ? `everyone in ${a.company.code}` : "";
    ev.push({ date: a.dueDate!, type: "training", title: `Training due: ${what}`, sub: who, href: a.sessionId ? `/training/sessions/${a.sessionId}` : "/training", companies: a.company ? [a.company.code] : [] });
  }
  return ev.sort((a, b) => a.date.getTime() - b.date.getTime() || a.type.localeCompare(b.type));
}
