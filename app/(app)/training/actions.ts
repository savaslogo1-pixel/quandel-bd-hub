"use server";

import type { DeliverableKind, SubmissionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { all, date, int, str, type FormState } from "@/lib/forms";
import { canFacilitate } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { ATTESTATION_STATEMENT, CAPSTONE_RUBRIC, gradeQuiz, rubricTotal } from "@/lib/training/logic";
import { refreshProgress } from "@/lib/training/progress";

const MAX_FILE = 10 * 1024 * 1024;

async function facilitator() {
  const u = await requireUser();
  if (!canFacilitate(u.role)) throw new Error("Facilitators only (admins and BD directors).");
  return u;
}
const refresh = (sessionId?: string) => {
  revalidatePath("/training", "layout");
  if (sessionId) revalidatePath(`/training/sessions/${sessionId}`);
  revalidatePath("/");
};

/* ───── learner ───── */

export async function markDeckReviewed(sessionId: string) {
  const u = await requireUser();
  await prisma.sessionProgress.upsert({
    where: { userId_sessionId: { userId: u.id, sessionId } },
    update: { deckReviewedAt: new Date() },
    create: { userId: u.id, sessionId, deckReviewedAt: new Date() },
  });
  await refreshProgress(u.id, sessionId);
  refresh(sessionId);
}

export async function submitQuiz(sessionId: string, _: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const s = await prisma.trainingSession.findUnique({ where: { id: sessionId }, include: { questions: { where: { active: true } } } });
  if (!s || !s.questions.length) return { error: "This session has no quiz yet." };
  const answers: Record<string, number> = {};
  for (const q of s.questions) {
    const v = str(fd, `q_${q.id}`);
    if (v != null) answers[q.id] = Number(v);
  }
  const missing = s.questions.filter((q) => answers[q.id] == null).length;
  if (missing) return { error: `Answer every question (${missing} left).` };
  const g = gradeQuiz(s.questions.map((q) => ({ id: q.id, correctIndex: q.correctIndex, options: JSON.parse(q.options) })), answers, s.passPct);
  const a = await prisma.quizAttempt.create({ data: { sessionId, userId: u.id, answers: JSON.stringify(answers), ...g } });
  await refreshProgress(u.id, sessionId);
  refresh(sessionId);
  redirect(`/training/sessions/${sessionId}/quiz?attempt=${a.id}`);
}

export async function submitDeliverable(sessionId: string, _: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const s = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!s?.deliverableTitle) return { error: "This session has no deliverable." };
  const link = str(fd, "link");
  if (link && !/^https?:\/\//i.test(link)) return { fieldErrors: { Link: "Use a full web address starting with https://" } };
  const opportunityId = str(fd, "opportunityId");
  if (opportunityId && !(await prisma.opportunity.findUnique({ where: { id: opportunityId }, select: { id: true } }))) return { fieldErrors: { Opportunity: "Not found" } };
  const file = fd.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && file.size > MAX_FILE) return { fieldErrors: { File: "Files up to 10 MB" } };
  if (!link && !opportunityId && !hasFile) return { error: "Attach a file, paste a link, or pick the opportunity you built it on." };
  await prisma.deliverableSubmission.create({
    data: {
      sessionId, userId: u.id, link, opportunityId, note: str(fd, "note"),
      ...(hasFile ? { fileName: file.name, fileType: file.type || "application/octet-stream", fileData: Buffer.from(await file.arrayBuffer()) } : {}),
    },
  });
  await refreshProgress(u.id, sessionId);
  refresh(sessionId);
  revalidatePath("/training/review");
  redirect(`/training/sessions/${sessionId}?submitted=1`);
}

export async function attest() {
  const u = await requireUser();
  const year = new Date().getUTCFullYear();
  await prisma.ethicsAttestation.upsert({ where: { userId_year: { userId: u.id, year } }, update: {}, create: { userId: u.id, year, statement: ATTESTATION_STATEMENT } });
  refresh();
  revalidatePath("/compliance");
}

export async function startNinetyDays(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const start = date(fd, "startDate");
  if (!start) return { fieldErrors: { "Start date": "Pick your start date" } };
  await prisma.ninetyDayPlan.upsert({ where: { userId: u.id }, update: { startDate: start }, create: { userId: u.id, startDate: start, checks: "{}" } });
  revalidatePath("/training/ninety");
  return undefined;
}

export async function toggleNinety(key: string) {
  const u = await requireUser();
  const p = await prisma.ninetyDayPlan.findUnique({ where: { userId: u.id } });
  if (!p) return;
  const c = JSON.parse(p.checks) as Record<string, string>;
  if (c[key]) delete c[key]; else c[key] = new Date().toISOString();
  await prisma.ninetyDayPlan.update({ where: { id: p.id }, data: { checks: JSON.stringify(c) } });
  revalidatePath("/training/ninety");
}

/* ───── facilitator: sessions, modules, quizzes ───── */

const KINDS: DeliverableKind[] = ["LINK", "CAPITAL_STACK", "APPROVALS", "CAPSTONE"];

export async function updateSession(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await facilitator();
  const passPct = int(fd, "passPct") ?? 80;
  if (Number.isNaN(passPct) || passPct < 1 || passPct > 100) return { fieldErrors: { "Pass mark": "Use 1 to 100" } };
  const kind = str(fd, "deliverableKind") as DeliverableKind | null;
  if (kind && !KINDS.includes(kind)) return { fieldErrors: { "Deliverable kind": "Invalid" } };
  const urls = ["deckUrl", "notesUrl", "glossaryUrl", "templateUrl"].map((k) => [k, str(fd, k)] as const);
  for (const [k, v] of urls) if (v && !/^https?:\/\//i.test(v)) return { fieldErrors: { [k]: "Use a full web address" } };
  await prisma.trainingSession.update({
    where: { id },
    data: {
      ...Object.fromEntries(urls), title: str(fd, "title") ?? undefined, passPct,
      deliverableTitle: str(fd, "deliverableTitle"), deliverableKind: str(fd, "deliverableTitle") ? kind ?? "LINK" : null,
      applyIt: str(fd, "applyIt"), applyItHref: str(fd, "applyItHref"),
    },
  });
  refresh(id);
  return undefined;
}

export async function addModule(sessionId: string, _: FormState, fd: FormData): Promise<FormState> {
  await facilitator();
  const title = str(fd, "title");
  if (!title) return { fieldErrors: { Title: "Required" } };
  const max = await prisma.trainingModule.aggregate({ where: { sessionId }, _max: { sortOrder: true } });
  await prisma.trainingModule.create({ data: { sessionId, title, url: str(fd, "url"), sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  refresh(sessionId);
  return undefined;
}

export async function deleteModule(id: string) {
  await facilitator();
  const m = await prisma.trainingModule.delete({ where: { id } });
  refresh(m.sessionId);
}

function parseQuestion(fd: FormData) {
  const prompt = str(fd, "prompt");
  const options = [1, 2, 3, 4, 5, 6].map((i) => str(fd, `option${i}`)).filter((o): o is string => !!o);
  const correct = int(fd, "correct");
  const fe: Record<string, string> = {};
  if (!prompt) fe.Question = "Required";
  if (options.length < 2) fe.Answers = "Give at least two answers";
  if (correct == null || Number.isNaN(correct) || correct < 1 || correct > 6 || !str(fd, `option${correct}`)) fe["Correct answer"] = "Pick which answer is right";
  // Correct index among the non-empty options, in order.
  const filledIdx = [1, 2, 3, 4, 5, 6].filter((i) => str(fd, `option${i}`));
  return { fe, data: { prompt: prompt ?? "", options: JSON.stringify(options), correctIndex: filledIdx.indexOf(correct ?? -1), explanation: str(fd, "explanation") } };
}

export async function addQuestion(sessionId: string, _: FormState, fd: FormData): Promise<FormState> {
  const u = await facilitator();
  const { fe, data } = parseQuestion(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const max = await prisma.quizQuestion.aggregate({ where: { sessionId }, _max: { sortOrder: true } });
  await prisma.quizQuestion.create({ data: { ...data, sessionId, sortOrder: (max._max.sortOrder ?? 0) + 1, createdById: u.id } });
  revalidatePath(`/training/sessions/${sessionId}/questions`);
  refresh(sessionId);
  redirect(`/training/sessions/${sessionId}/questions?added=1`);
}

export async function updateQuestion(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await facilitator();
  const { fe, data } = parseQuestion(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const q = await prisma.quizQuestion.update({ where: { id }, data });
  revalidatePath(`/training/sessions/${q.sessionId}/questions`);
  return undefined;
}

export async function toggleQuestion(id: string) {
  await facilitator();
  const q = await prisma.quizQuestion.findUnique({ where: { id } });
  if (!q) return;
  await prisma.quizQuestion.update({ where: { id }, data: { active: !q.active } });
  revalidatePath(`/training/sessions/${q.sessionId}/questions`);
  refresh(q.sessionId);
}

export async function deleteQuestion(id: string) {
  await facilitator();
  const q = await prisma.quizQuestion.delete({ where: { id } });
  revalidatePath(`/training/sessions/${q.sessionId}/questions`);
  refresh(q.sessionId);
}

/* ───── facilitator: reviews, assignments ───── */

const STATUSES: SubmissionStatus[] = ["ACCEPTED", "NEEDS_REVISION"];

export async function reviewSubmission(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const u = await facilitator();
  const sub = await prisma.deliverableSubmission.findUnique({ where: { id }, include: { session: true } });
  if (!sub) return { error: "Submission not found." };
  const status = str(fd, "status") as SubmissionStatus | null;
  if (!status || !STATUSES.includes(status)) return { fieldErrors: { Decision: "Accept it or ask for a revision" } };
  let score = int(fd, "score");
  let rubricScores: string | null = null;
  const ethicsViolation = fd.get("ethicsViolation") === "on";
  if (sub.session.deliverableKind === "CAPSTONE") {
    const scores: Record<string, number> = {};
    for (const c of CAPSTONE_RUBRIC.criteria) {
      const v = int(fd, `r_${c.key}`);
      if (v == null || Number.isNaN(v) || v < 0 || v > c.max) return { fieldErrors: { [c.label]: `Score 0 to ${c.max}` } };
      scores[c.key] = v;
    }
    rubricScores = JSON.stringify(scores);
    score = rubricTotal(CAPSTONE_RUBRIC, scores, ethicsViolation);
  } else if (score != null && (Number.isNaN(score) || score < 0 || score > 100)) return { fieldErrors: { Score: "Use 0 to 100" } };
  if (status === "NEEDS_REVISION" && !str(fd, "feedback")) return { fieldErrors: { Feedback: "Say what to revise" } };
  await prisma.deliverableSubmission.update({
    where: { id },
    data: { status, score: score ?? null, rubricScores, ethicsViolation, feedback: str(fd, "feedback"), reviewedById: u.id, reviewedAt: new Date() },
  });
  await refreshProgress(sub.userId, sub.sessionId);
  refresh(sub.sessionId);
  revalidatePath("/training/review");
  return undefined;
}

export async function createAssignment(_: FormState, fd: FormData): Promise<FormState> {
  const u = await facilitator();
  const target = str(fd, "target"); // "s:<id>" or "e:<id>"
  const who = str(fd, "who"); // "u:<id>" or "c:<id>"
  if (!target || !/^[se]:/.test(target)) return { fieldErrors: { Training: "Pick a session or a whole edition" } };
  if (!who || !/^[uc]:/.test(who)) return { fieldErrors: { "Assign to": "Pick a person or a company" } };
  await prisma.trainingAssignment.create({
    data: {
      sessionId: target.startsWith("s:") ? target.slice(2) : null, editionId: target.startsWith("e:") ? target.slice(2) : null,
      userId: who.startsWith("u:") ? who.slice(2) : null, companyId: who.startsWith("c:") ? who.slice(2) : null,
      dueDate: date(fd, "dueDate"), note: str(fd, "note"), assignedById: u.id,
    },
  });
  refresh();
  return undefined;
}

export async function deleteAssignment(id: string) {
  await facilitator();
  await prisma.trainingAssignment.delete({ where: { id } });
  refresh();
}

/* ───── capstone (SPEC §10.4) ───── */

export async function createCapstone(_: FormState, fd: FormData): Promise<FormState> {
  const u = await facilitator();
  const editionId = str(fd, "editionId");
  const title = str(fd, "title");
  if (!editionId || !title) return { fieldErrors: { Event: "Edition and title are required" } };
  const minutes = int(fd, "minutesPerTeam");
  await prisma.capstoneEvent.create({ data: { editionId, title, scheduledAt: date(fd, "scheduledAt"), minutesPerTeam: minutes && !Number.isNaN(minutes) ? minutes : null, notes: str(fd, "notes"), createdById: u.id } });
  refresh();
  return undefined;
}

export async function addTeam(eventId: string, _: FormState, fd: FormData): Promise<FormState> {
  await facilitator();
  const name = str(fd, "name");
  if (!name) return { fieldErrors: { Team: "Name the team" } };
  const members = all(fd, "members");
  const roles = Object.fromEntries((fd.getAll("roleName") as string[]).map((r, i) => [r, (fd.getAll("roleWho") as string[])[i] ?? ""]).filter(([, v]) => v));
  await prisma.capstoneTeam.create({ data: { eventId, name, memberIds: JSON.stringify(members), opportunityId: str(fd, "opportunityId"), boardRoles: JSON.stringify(roles) } });
  revalidatePath("/training/capstone");
  return undefined;
}

export async function scoreTeam(teamId: string, _: FormState, fd: FormData): Promise<FormState> {
  const u = await facilitator();
  const scores: Record<string, number> = {};
  for (const c of CAPSTONE_RUBRIC.criteria) {
    const v = int(fd, `r_${c.key}`);
    if (v == null || Number.isNaN(v) || v < 0 || v > c.max) return { fieldErrors: { [c.label]: `Score 0 to ${c.max}` } };
    scores[c.key] = v;
  }
  const ethicsViolation = fd.get("ethicsViolation") === "on";
  await prisma.capstoneTeam.update({
    where: { id: teamId },
    data: { rubricScores: JSON.stringify(scores), ethicsViolation, total: rubricTotal(CAPSTONE_RUBRIC, scores, ethicsViolation), feedback: str(fd, "feedback"), scoredById: u.id, scoredAt: new Date() },
  });
  revalidatePath("/training/capstone");
  return undefined;
}

export async function deleteTeam(id: string) {
  await facilitator();
  await prisma.capstoneTeam.delete({ where: { id } });
  revalidatePath("/training/capstone");
}

/* ───── reference library (SPEC §10.3) ───── */

export async function addLibraryItem(_: FormState, fd: FormData): Promise<FormState> {
  const u = await facilitator();
  const kind = str(fd, "kind");
  const title = str(fd, "title");
  if (!kind || !title) return { fieldErrors: { Item: "Kind and title are required" } };
  const url = str(fd, "url");
  if (url && !/^https?:\/\//i.test(url)) return { fieldErrors: { Link: "Use a full web address" } };
  await prisma.libraryItem.create({ data: { kind, title, body: str(fd, "body"), url, states: all(fd, "states").join(",") || null, createdById: u.id } });
  revalidatePath("/training/library");
  return undefined;
}

export async function deleteLibraryItem(id: string) {
  await facilitator();
  await prisma.libraryItem.delete({ where: { id } });
  revalidatePath("/training/library");
}
