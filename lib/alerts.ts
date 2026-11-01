import { prisma } from "./db";
import { daysFromToday, fmtDate, todayUTC, ymd } from "./format";
import { alertBand } from "./programs";

/**
 * Deadline alerts (SPEC §4.5): for every open opportunity whose capital stack uses a program
 * with a next deadline in 90 days or less, the pursuit owner (or creator) gets one in-app
 * notification per band: 90, 60, 30 and 14 days. Rows already awarded, denied or closed are skipped.
 * Runs when people open the app; also callable from a scheduled job (see /api/alerts/run).
 */
export async function generateDeadlineAlerts(userId?: string): Promise<number> {
  const today = todayUTC();
  const horizon = new Date(today.getTime() + 90 * 86_400_000);
  const rows = await prisma.capitalStackRow.findMany({
    where: {
      status: { in: ["IDEA", "APPLIED"] },
      program: { nextDeadline: { gte: today, lte: horizon } },
      opportunity: { stage: { lt: 9 }, ...(userId ? { OR: [{ ownerId: userId }, { ownerId: null, createdById: userId }] } : {}) },
    },
    include: { program: true, opportunity: { select: { id: true, name: true, ownerId: true, createdById: true } } },
  });
  let created = 0;
  for (const r of rows) {
    const p = r.program!;
    const who = r.opportunity.ownerId ?? r.opportunity.createdById;
    if (!who || !p.nextDeadline) continue;
    const left = daysFromToday(p.nextDeadline);
    const band = alertBand(left);
    if (!band) continue;
    const key = `deadline:${p.id}:${ymd(p.nextDeadline)}:${r.opportunity.id}:${band}`;
    const res = await prisma.notification.upsert({
      where: { userId_key: { userId: who, key } },
      update: {},
      create: {
        userId: who, key, kind: "deadline",
        title: `${p.name} deadline in ${left} day${left === 1 ? "" : "s"}`,
        body: `${fmtDate(p.nextDeadline)} · on the capital stack for ${r.opportunity.name} (${band}-day alert)`,
        link: `/opportunities/${r.opportunity.id}?tab=stack`,
      },
    });
    if (res.createdAt.getTime() > Date.now() - 5000) created++;
  }
  return created;
}
