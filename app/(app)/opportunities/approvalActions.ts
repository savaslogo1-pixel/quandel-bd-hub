"use server";

import type { ApprovalDocument, ApprovalStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { APPROVAL_TEMPLATES, DOCUMENT_LABELS } from "@/lib/approvals";
import { prisma } from "@/lib/db";
import { badNumbers, bool, date, int, str, type FormState } from "@/lib/forms";
import { todayUTC } from "@/lib/format";
import { parsePattern } from "@/lib/meetings";
import { canEditOpportunities } from "@/lib/permissions";
import { loadRules } from "@/lib/rules";
import { scheduleBackward } from "@/lib/scheduler";
import { requireUser } from "@/lib/session";

const STATUSES: ApprovalStatus[] = ["PLANNED", "SCHEDULED", "DONE"];

async function guard() {
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) throw new Error("Your role can't change approvals timelines.");
  return user;
}
function refresh(oppId: string) {
  revalidatePath(`/opportunities/${oppId}`);
  revalidatePath("/calendar");
}

/** Replace the timeline with a state template (SPEC §4.7). */
export async function loadTemplate(oppId: string, state: string) {
  const user = await guard();
  const t = APPROVAL_TEMPLATES[state];
  if (!t) return;
  await prisma.$transaction([
    prisma.approvalStep.deleteMany({ where: { opportunityId: oppId } }),
    prisma.approvalStep.createMany({
      data: t.steps.map((s, i) => ({
        opportunityId: oppId, sortOrder: i + 1, label: s.label, body: s.body, document: s.document,
        needsMeeting: s.needsMeeting, waitRuleKey: s.waitRuleKey ?? null, createdById: user.id,
      })),
    }),
    prisma.opportunity.update({ where: { id: oppId }, data: { approvalsTemplate: state } }),
  ]);
  refresh(oppId);
}

function parseStep(fd: FormData) {
  const fe: Record<string, string> = {};
  const label = str(fd, "label");
  if (!label) fe.Step = "Required";
  const document = (str(fd, "document") ?? "OTHER") as ApprovalDocument;
  if (!(document in DOCUMENT_LABELS)) fe.Document = "Invalid";
  const status = (str(fd, "status") ?? "PLANNED") as ApprovalStatus;
  if (!STATUSES.includes(status)) fe.Status = "Invalid";
  const waitAfterDays = int(fd, "waitAfterDays");
  Object.assign(fe, badNumbers({ "Wait after": waitAfterDays }));
  return {
    fe,
    data: {
      label: label ?? "", body: str(fd, "body"), document, status, needsMeeting: bool(fd, "needsMeeting"),
      waitAfterDays, waitRuleKey: str(fd, "waitRuleKey"), notes: str(fd, "notes"), ownerContactId: str(fd, "ownerContactId"),
    },
    meetingDate: date(fd, "meetingDate"),
  };
}

export async function addStep(oppId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await guard();
  const { fe, data, meetingDate } = parseStep(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const max = await prisma.approvalStep.aggregate({ where: { opportunityId: oppId }, _max: { sortOrder: true } });
  await prisma.approvalStep.create({ data: { ...data, meetingDate, dateSetBy: meetingDate ? "manual" : null, opportunityId: oppId, sortOrder: (max._max.sortOrder ?? 0) + 1, createdById: user.id } });
  refresh(oppId);
  return undefined;
}

export async function updateStep(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await guard();
  const { fe, data, meetingDate } = parseStep(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const before = await prisma.approvalStep.findUnique({ where: { id } });
  if (!before) return { error: "Step not found." };
  const dateChanged = (before.meetingDate?.getTime() ?? null) !== (meetingDate?.getTime() ?? null);
  await prisma.approvalStep.update({ where: { id }, data: { ...data, meetingDate, ...(dateChanged ? { dateSetBy: "manual", agendaDeadline: null } : {}) } });
  refresh(before.opportunityId);
  return undefined;
}

export async function setStepStatus(id: string, status: ApprovalStatus) {
  await guard();
  if (!STATUSES.includes(status)) return;
  const s = await prisma.approvalStep.update({ where: { id }, data: { status } });
  refresh(s.opportunityId);
}

export async function deleteStep(id: string) {
  await guard();
  const s = await prisma.approvalStep.delete({ where: { id } });
  refresh(s.opportunityId);
}

export async function moveStep(id: string, dir: -1 | 1) {
  await guard();
  const s = await prisma.approvalStep.findUnique({ where: { id } });
  if (!s) return;
  const steps = await prisma.approvalStep.findMany({ where: { opportunityId: s.opportunityId }, orderBy: { sortOrder: "asc" } });
  const i = steps.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= steps.length) return;
  [steps[i], steps[j]] = [steps[j], steps[i]];
  await prisma.$transaction(steps.map((x, n) => prisma.approvalStep.update({ where: { id: x.id }, data: { sortOrder: n + 1 } })));
  refresh(s.opportunityId);
}

export type ScheduleState = (FormState & { warnings?: string[]; done?: boolean }) | undefined;

/** Run the backward scheduler and save the proposed dates on every step that isn't done. */
export async function runScheduler(oppId: string, _: ScheduleState, fd: FormData): Promise<ScheduleState> {
  await guard();
  const deadline = date(fd, "deadline");
  if (!deadline) return { fieldErrors: { Deadline: "Pick the date the last step must meet" } };
  const buffer = int(fd, "bufferDays") ?? 7;
  if (Number.isNaN(buffer) || buffer < 1 || buffer > 90) return { fieldErrors: { "Buffer days": "Use 1 to 90" } };
  const opp = await prisma.opportunity.findUnique({ where: { id: oppId }, include: { org: true, approvalSteps: { orderBy: { sortOrder: "asc" } } } });
  if (!opp) return { error: "Opportunity not found." };
  if (!opp.approvalSteps.length) return { error: "Load a template or add steps first." };
  const rules = await loadRules();
  const warnings: string[] = [];
  const steps = opp.approvalSteps.map((s) => {
    let wait = s.waitAfterDays;
    if (s.waitRuleKey) {
      const r = rules[s.waitRuleKey];
      if (r?.value != null) wait = r.value;
      else warnings.push(`State rule ${s.waitRuleKey} has no value yet, so "${s.label}" uses the buffer instead of its waiting period. [confirm]`);
      if (r && !r.lastVerifiedAt) warnings.push(`State rule ${s.waitRuleKey} (${r.value ?? "?"} ${r.unit ?? ""}) is unverified.`);
    }
    return { id: s.id, label: s.label, needsMeeting: s.needsMeeting, waitAfterDays: wait };
  });
  const result = scheduleBackward({
    steps, deadline, bufferDays: buffer, today: todayUTC(),
    pattern: parsePattern(opp.org.meetingWeekday, opp.org.meetingWeeksOfMonth), agendaDays: opp.org.agendaDeadlineDays,
  });
  const done = opp.approvalSteps.filter((s) => s.status === "DONE");
  await prisma.$transaction([
    ...opp.approvalSteps
      .filter((s) => s.status !== "DONE")
      .map((s) => prisma.approvalStep.update({ where: { id: s.id }, data: { meetingDate: result.dates[s.id].date, agendaDeadline: result.dates[s.id].agendaDeadline, dateSetBy: "scheduler" } })),
    prisma.opportunity.update({ where: { id: oppId }, data: { approvalsDeadline: deadline, approvalsBufferDays: buffer } }),
  ]);
  if (done.length) warnings.push(`${done.length} step${done.length === 1 ? " is" : "s are"} already done and kept ${done.length === 1 ? "its" : "their"} date.`);
  refresh(oppId);
  return { done: true, warnings: [...result.warnings, ...warnings] };
}
