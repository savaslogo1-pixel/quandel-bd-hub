import { prisma } from "../db";
import { sessionParts, type SessionParts } from "./logic";

export type SessionView = {
  id: string; code: string; title: string; sortOrder: number; editionId: string; editionCode: string;
  deckUrl: string | null; deliverableTitle: string | null; questionCount: number;
  bestScore: number | null; attempts: number; submissionStatus: "SUBMITTED" | "ACCEPTED" | "NEEDS_REVISION" | null;
  parts: SessionParts; completedAt: Date | null; dueDate: Date | null;
};

/** Every session (optionally one edition) with this learner's status. */
export async function learnerSessions(userId: string, editionId?: string): Promise<SessionView[]> {
  const [sessions, progress, attempts, subs, dues] = await Promise.all([
    prisma.trainingSession.findMany({
      where: editionId ? { editionId } : {},
      include: { edition: { select: { code: true } }, _count: { select: { questions: { where: { active: true } } } } },
      orderBy: [{ edition: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    prisma.sessionProgress.findMany({ where: { userId } }),
    prisma.quizAttempt.groupBy({ by: ["sessionId"], where: { userId }, _max: { scorePct: true }, _count: true }),
    prisma.deliverableSubmission.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { sessionId: true, status: true } }),
    dueDates(userId),
  ]);
  const prog = new Map(progress.map((p) => [p.sessionId, p]));
  const att = new Map(attempts.map((a) => [a.sessionId, a]));
  const passedIds = new Set((await prisma.quizAttempt.findMany({ where: { userId, passed: true }, select: { sessionId: true } })).map((a) => a.sessionId));
  const latestSub = new Map<string, (typeof subs)[number]["status"]>();
  for (const s of subs) if (!latestSub.has(s.sessionId)) latestSub.set(s.sessionId, s.status);
  const accepted = new Set(subs.filter((s) => s.status === "ACCEPTED").map((s) => s.sessionId));
  return sessions.map((s) => {
    const p = prog.get(s.id);
    const parts = sessionParts({
      deckReviewed: !!p?.deckReviewedAt,
      questionCount: s._count.questions,
      bestAttemptPassed: passedIds.has(s.id),
      hasDeliverable: !!s.deliverableTitle,
      deliverableAccepted: accepted.has(s.id),
    });
    return {
      id: s.id, code: s.code, title: s.title, sortOrder: s.sortOrder, editionId: s.editionId, editionCode: s.edition.code,
      deckUrl: s.deckUrl, deliverableTitle: s.deliverableTitle, questionCount: s._count.questions,
      bestScore: att.get(s.id)?._max.scorePct ?? null, attempts: att.get(s.id)?._count ?? 0,
      submissionStatus: latestSub.get(s.id) ?? null, parts, completedAt: p?.completedAt ?? null,
      dueDate: dues.session.get(s.id) ?? dues.edition.get(s.editionId) ?? null,
    };
  });
}

/** Earliest due date per session and per edition from assignments to this person or their companies. */
export async function dueDates(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { companies: { select: { id: true } } } });
  const rows = await prisma.trainingAssignment.findMany({
    where: { OR: [{ userId }, { companyId: { in: (u?.companies ?? []).map((c) => c.id) } }] },
    select: { sessionId: true, editionId: true, dueDate: true },
  });
  const session = new Map<string, Date>();
  const edition = new Map<string, Date>();
  for (const r of rows) {
    const d = r.dueDate ?? new Date(8.64e15);
    if (r.sessionId && (!session.has(r.sessionId) || d < session.get(r.sessionId)!)) session.set(r.sessionId, d);
    if (r.editionId && (!edition.has(r.editionId) || d < edition.get(r.editionId)!)) edition.set(r.editionId, d);
  }
  const clean = (m: Map<string, Date>) => new Map([...m].map(([k, v]) => [k, v.getTime() === 8.64e15 ? (null as unknown as Date) : v]));
  return { session: clean(session), edition: clean(edition), assigned: rows.length > 0, sessionIds: new Set(rows.map((r) => r.sessionId).filter(Boolean) as string[]), editionIds: new Set(rows.map((r) => r.editionId).filter(Boolean) as string[]) };
}

/** Recompute whether a session is complete; issue the edition certificate when every session is. */
export async function refreshProgress(userId: string, sessionId: string) {
  const s = await prisma.trainingSession.findUnique({ where: { id: sessionId }, select: { editionId: true } });
  if (!s) return;
  const views = await learnerSessions(userId, s.editionId);
  const v = views.find((x) => x.id === sessionId);
  if (!v) return;
  const p = await prisma.sessionProgress.findUnique({ where: { userId_sessionId: { userId, sessionId } } });
  if (v.parts.complete && !p?.completedAt)
    await prisma.sessionProgress.upsert({ where: { userId_sessionId: { userId, sessionId } }, update: { completedAt: new Date() }, create: { userId, sessionId, completedAt: new Date() } });
  if (!v.parts.complete && p?.completedAt) await prisma.sessionProgress.update({ where: { id: p.id }, data: { completedAt: null } });
  if (views.length && views.every((x) => (x.id === sessionId ? v.parts.complete : x.parts.complete)))
    await prisma.certificate.upsert({ where: { userId_editionId: { userId, editionId: s.editionId } }, update: {}, create: { userId, editionId: s.editionId } });
}

export async function attestedThisYear(userId: string) {
  return prisma.ethicsAttestation.findUnique({ where: { userId_year: { userId, year: new Date().getUTCFullYear() } } });
}
