import { toGate, oppInclude } from "@/app/(app)/opportunities/data";
import { giftLimitKey, giftOverLimit, lobbyingKey, lobbyingStatus } from "./compliance";
import { prisma } from "./db";
import { complianceFlags } from "./pipeline";
import { loadRules } from "./rules";

export type Flag = { level: "bad" | "warn"; kind: string; text: string; where: string; href: string };

/** Every open compliance flag across opportunities, activities, gifts and lobbying. */
export async function openFlags(): Promise<Flag[]> {
  const year = new Date().getUTCFullYear();
  const [opps, acts, gifts, lob, rules] = await Promise.all([
    prisma.opportunity.findMany({ where: { OR: [{ stage: { lt: 9 } }, { stage: 9, outcome: null }] }, include: oppInclude }),
    prisma.activity.findMany({ where: { financingDiscussed: true, financialAdvisorContactId: null }, include: { org: { select: { name: true } } } }),
    prisma.giftEntry.findMany({ where: { date: { gte: new Date(Date.UTC(year - 1, 0, 1)) } }, include: { giver: { select: { name: true, email: true } } } }),
    lobbyingTotals(year),
    loadRules(),
  ]);
  const f: Flag[] = [];
  for (const o of opps) for (const x of complianceFlags(toGate(o))) f.push({ level: x.level, kind: "Procurement", text: x.text, where: `${o.name} · ${o.org.name}`, href: `/opportunities/${o.id}` });
  for (const a of acts) f.push({ level: "bad", kind: "Municipal advisor", text: "Financing discussed; owner's financial advisor not linked", where: a.org.name, href: `/activities/${a.id}` });
  for (const g of gifts) {
    const who = g.giver.name ?? g.giver.email;
    const over = giftOverLimit(Number(g.value), rules[giftLimitKey(g.state)]?.value ?? null);
    if (over) f.push({ level: "bad", kind: "Gift", text: `Over the ${g.state} limit ($${rules[giftLimitKey(g.state)]!.value})`, where: `${g.recipientName} · ${who}`, href: "/compliance/gifts" });
    if (!g.approverId) f.push({ level: "warn", kind: "Gift", text: "No internal approver", where: `${g.recipientName} · ${who}`, href: "/compliance/gifts" });
    if (!g.reviewedAt) f.push({ level: "warn", kind: "Gift", text: "Awaiting compliance review", where: `${g.recipientName} · ${who}`, href: "/compliance/gifts" });
  }
  for (const l of lob) {
    if (l.status.state === "over") f.push({ level: "bad", kind: "Lobbying", text: `At or over the ${l.jurisdiction} registration threshold`, where: `${l.jurisdiction} ${year}`, href: "/compliance/lobbying" });
    else if (l.status.state === "near") f.push({ level: "warn", kind: "Lobbying", text: `${Math.round(l.status.pct!)}% of the ${l.jurisdiction} registration threshold`, where: `${l.jurisdiction} ${year}`, href: "/compliance/lobbying" });
  }
  return f.sort((a, b) => (a.level === b.level ? 0 : a.level === "bad" ? -1 : 1));
}

/** Year-to-date lobbying by jurisdiction vs the State rules threshold. */
export async function lobbyingTotals(year: number) {
  const rows = await prisma.lobbyingEntry.groupBy({
    by: ["jurisdiction"],
    where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
    _sum: { hours: true, expenses: true },
  });
  const rules = await loadRules();
  return rows.map((r) => {
    const threshold = rules[lobbyingKey(r.jurisdiction)]?.value ?? null;
    const spend = Number(r._sum.expenses ?? 0);
    return { jurisdiction: r.jurisdiction, hours: Number(r._sum.hours ?? 0), spend, threshold, status: lobbyingStatus(spend, threshold) };
  });
}
