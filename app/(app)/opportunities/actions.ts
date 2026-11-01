"use server";

import type { DeliveryMethod, DisclosureDecision, GoNoGo, Outcome } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PICKLISTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { all, badNumbers, bool, date, dec, int, str, type FormState } from "@/lib/forms";
import { canDecideGoNoGo, canDelete, canEditOpportunities } from "@/lib/permissions";
import { DELIVERY_METHODS, STAGE_COUNT, checklistFor, stageBlockers } from "@/lib/pipeline";
import { suggestCompanies } from "@/lib/routing";
import { requireUser } from "@/lib/session";
import { loadOpp, toGate } from "./data";


function revalidate(id?: string, orgId?: string) {
  revalidatePath("/pipeline");
  revalidatePath("/");
  if (id) revalidatePath(`/opportunities/${id}`);
  if (orgId) revalidatePath(`/organizations/${orgId}`);
}

async function parse(fd: FormData) {
  const fe: Record<string, string> = {};
  const name = str(fd, "name");
  if (!name) fe.Name = "Required";
  const orgId = str(fd, "orgId");
  const org = orgId ? await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, state: true, orgType: true } }) : null;
  if (!org) fe.Owner = "Choose the owner organization";
  const projectType = str(fd, "projectType");
  if (projectType && !(await prisma.picklistValue.findFirst({ where: { list: PICKLISTS.projectType, value: projectType } }))) fe["Project type"] = "Not in the list";
  const deliveryMethod = str(fd, "deliveryMethod") as DeliveryMethod | null;
  if (deliveryMethod && !DELIVERY_METHODS.includes(deliveryMethod)) fe["Delivery method"] = "Invalid";
  const probability = int(fd, "probability");
  const estimatedValue = dec(fd, "estimatedValue");
  const quandelScopeValue = dec(fd, "quandelScopeValue");
  Object.assign(fe, badNumbers({ Probability: probability, "Estimated value": estimatedValue, "Quandel scope value": quandelScopeValue }));
  if (probability != null && !Number.isNaN(probability) && (probability < 0 || probability > 100)) fe.Probability = "Use 0 to 100";
  const nonEnergyScope = bool(fd, "nonEnergyScope");

  // Lead company: chosen, or the routing suggestion when left blank.
  let leadCompanyId = str(fd, "leadCompanyId");
  let supportIds = all(fd, "supportCompanies");
  let routed: string[] = [];
  if (!leadCompanyId && org) {
    routed = suggestCompanies({ projectType, deliveryMethod, nonEnergyScope, org }).codes;
    if (routed.length) {
      const cos = await prisma.company.findMany({ where: { code: { in: routed } } });
      const byCode = Object.fromEntries(cos.map((c) => [c.code, c.id]));
      leadCompanyId = byCode[routed[0]];
      supportIds = [...new Set([...supportIds, ...routed.slice(1).map((c) => byCode[c])])];
    }
  }
  if (!leadCompanyId) fe["Lead company"] = "Choose a lead company (routing had no suggestion for this project type and state)";
  supportIds = supportIds.filter((s) => s && s !== leadCompanyId);

  return {
    fe, orgId: org?.id ?? "", leadCompanyId: leadCompanyId ?? "", supportIds, routed,
    data: {
      name: name ?? "", projectType, deliveryMethod, nonEnergyScope,
      estimatedValue, quandelScopeValue, probability,
      rfqIssueDate: date(fd, "rfqIssueDate"), preBidDate: date(fd, "preBidDate"), dueDate: date(fd, "dueDate"),
      interviewDate: date(fd, "interviewDate"), boardVoteDate: date(fd, "boardVoteDate"), awardDate: date(fd, "awardDate"),
      constructionStartDate: date(fd, "constructionStartDate"), substantialCompletionDate: date(fd, "substantialCompletionDate"),
      competitors: str(fd, "competitors"), winThemes: str(fd, "winThemes"),
    },
    ownerId: str(fd, "ownerId"),
  };
}

export async function createOpportunity(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) return { error: "Your role can view opportunities but not add them." };
  const { fe, data, orgId, leadCompanyId, supportIds, ownerId } = await parse(fd);
  const startStage = int(fd, "stage") ?? 1;
  if (Number.isNaN(startStage) || startStage < 1 || startStage > 5) fe["Starting stage"] = "Start at stage 1–5; later stages need the go/no-go and compliance steps";
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const opp = await prisma.opportunity.create({
    data: {
      ...data,
      stage: startStage,
      org: { connect: { id: orgId } },
      leadCompany: { connect: { id: leadCompanyId } },
      supportCompanies: { connect: supportIds.map((id) => ({ id })) },
      owner: ownerId ? { connect: { id: ownerId } } : undefined,
      createdBy: { connect: { id: user.id } },
      stageChanges: { create: { toStage: startStage, changedById: user.id, note: "Created" } },
    },
  });
  revalidate(opp.id, orgId);
  redirect(`/opportunities/${opp.id}`);
}

export async function updateOpportunity(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) return { error: "Your role can view opportunities but not edit them." };
  const { fe, data, orgId, leadCompanyId, supportIds, ownerId } = await parse(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  await prisma.opportunity.update({
    where: { id },
    data: {
      ...data,
      org: { connect: { id: orgId } },
      leadCompany: { connect: { id: leadCompanyId } },
      supportCompanies: { set: supportIds.map((i) => ({ id: i })) },
      owner: ownerId ? { connect: { id: ownerId } } : { disconnect: true },
    },
  });
  revalidate(id, orgId);
  redirect(`/opportunities/${id}`);
}

export async function deleteOpportunity(id: string) {
  const user = await requireUser();
  if (!canDelete(user.role)) throw new Error("Only admins and BD directors can delete opportunities.");
  const o = await prisma.opportunity.delete({ where: { id } });
  revalidate(undefined, o.orgId);
  redirect("/pipeline");
}

export type MoveResult = { ok: boolean; blockers?: string[]; error?: string };

/** Move to any stage. Forward moves are checked against stageBlockers; every move is logged. */
export async function moveStage(id: string, to: number, note?: string): Promise<MoveResult> {
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) return { ok: false, error: "Your role can't move opportunities." };
  if (!Number.isInteger(to) || to < 1 || to > STAGE_COUNT) return { ok: false, error: "Unknown stage." };
  const o = await loadOpp(id);
  if (!o) return { ok: false, error: "Opportunity not found." };
  if (o.stage === to) return { ok: true };
  const blockers = stageBlockers(toGate(o), to);
  if (blockers.length) return { ok: false, blockers };
  await prisma.opportunity.update({
    where: { id },
    data: {
      stage: to,
      stageEnteredAt: new Date(),
      // Moving back out of the result stages clears the result.
      ...(to < 9 && o.outcome ? { outcome: null } : {}),
      stageChanges: { create: { fromStage: o.stage, toStage: to, changedById: user.id, note: note ?? null } },
    },
  });
  revalidate(id, o.orgId);
  return { ok: true };
}

export async function setGoNoGo(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canDecideGoNoGo(user.role)) return { error: "Go/no-go decisions are recorded by leadership, a BD director or an admin." };
  const decision = str(fd, "goNoGo") as GoNoGo | null;
  if (!decision || !["GO", "NO_GO", "PENDING"].includes(decision)) return { fieldErrors: { Decision: "Choose Go, No-go or Pending" } };
  const reason = str(fd, "goNoGoReason");
  if (decision === "NO_GO" && !reason) return { fieldErrors: { Reason: "Say why it's a no-go" } };
  const o = await prisma.opportunity.update({ where: { id }, data: { goNoGo: decision, goNoGoReason: reason, goNoGoAt: new Date(), goNoGoApprover: { connect: { id: user.id } } } });
  revalidate(id, o.orgId);
  return undefined;
}

export async function setOutcome(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) return { error: "Your role can't record outcomes." };
  const outcome = str(fd, "outcome") as Outcome | null;
  if (!outcome || !["WON", "LOST", "NO_BID"].includes(outcome)) return { fieldErrors: { Outcome: "Choose Won, Lost or No-bid" } };
  const lossReason = str(fd, "lossReason");
  if (outcome !== "WON" && !lossReason) return { fieldErrors: { Reason: "Required for Lost or No-bid" } };
  const boardVoteDate = date(fd, "boardVoteDate");
  const o = await prisma.opportunity.update({ where: { id }, data: { outcome, lossReason, ...(boardVoteDate ? { boardVoteDate } : {}) } });
  revalidate(id, o.orgId);
  return undefined;
}

export async function setCompliance(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) return { error: "Your role can't record compliance confirmations." };
  const o = await prisma.opportunity.findUnique({ where: { id } });
  if (!o) return { error: "Opportunity not found." };
  const hs = str(fd, "helpedWriteSpecs");
  const helpedWriteSpecs = hs === "yes" ? true : hs === "no" ? false : null;
  const pi = bool(fd, "procIndependence");
  const ae = bool(fd, "aeNoConflictCert");
  const dd = str(fd, "disclosureDecision") as DisclosureDecision | null;
  const disclosureNote = str(fd, "disclosureNote");
  if (dd && dd !== "PENDING" && !disclosureNote) return { fieldErrors: { "Disclosure note": "Record who decided, when, and where it's documented (e.g., board minutes)" } };
  await prisma.opportunity.update({
    where: { id },
    data: {
      helpedWriteSpecs,
      // Keep the original confirmation time and person unless it's being cleared or newly set.
      procIndependenceAt: pi ? o.procIndependenceAt ?? new Date() : null,
      procIndependenceById: pi ? o.procIndependenceById ?? user.id : null,
      aeNoConflictCertAt: ae ? o.aeNoConflictCertAt ?? new Date() : null,
      disclosureDecision: dd,
      disclosureNote,
      ...(dd !== o.disclosureDecision || disclosureNote !== o.disclosureNote ? { disclosureAt: dd ? new Date() : null, disclosureById: dd ? user.id : null } : {}),
    },
  });
  revalidate(id, o.orgId);
  return undefined;
}

export async function toggleChecklistItem(id: string, key: string) {
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) return;
  const o = await prisma.opportunity.findUnique({ where: { id }, select: { deliveryMethod: true, orgId: true } });
  if (!o || !checklistFor(o.deliveryMethod)?.items.some((i) => i.key === key)) return;
  const existing = await prisma.opportunityChecklistItem.findUnique({ where: { opportunityId_itemKey: { opportunityId: id, itemKey: key } } });
  if (existing) await prisma.opportunityChecklistItem.delete({ where: { id: existing.id } });
  else await prisma.opportunityChecklistItem.create({ data: { opportunityId: id, itemKey: key, doneById: user.id } });
  revalidate(id, o.orgId);
}

export async function applyRouting(id: string) {
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) return;
  const o = await loadOpp(id);
  if (!o) return;
  const { codes } = suggestCompanies({ projectType: o.projectType, deliveryMethod: o.deliveryMethod, nonEnergyScope: o.nonEnergyScope, org: o.org });
  const cos = await prisma.company.findMany({ where: { code: { in: codes } } });
  const current = new Set([o.leadCompanyId, ...o.supportCompanies.map((c) => c.id)]);
  const add = cos.filter((c) => !current.has(c.id));
  if (!add.length) return;
  await prisma.opportunity.update({ where: { id }, data: { supportCompanies: { connect: add.map((c) => ({ id: c.id })) } } });
  revalidate(id, o.orgId);
}
