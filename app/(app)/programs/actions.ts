"use server";

import type { MatchBasis, OtherSource, ProgramType, StackStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { badNumbers, bool, date, dec, int, str, type FormState } from "@/lib/forms";
import { canDelete, canEditOpportunities, canEditPrograms } from "@/lib/permissions";
import { JURISDICTIONS, MATCH_BASIS_LABELS, OTHER_SOURCE_LABELS, PROGRAM_TYPE_LABELS, STACK_STATUS_LABELS } from "@/lib/programs";
import { requireUser } from "@/lib/session";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseProgram(fd: FormData) {
  const fe: Record<string, string> = {};
  const name = str(fd, "name");
  if (!name) fe.Name = "Required";
  const jurisdiction = str(fd, "jurisdiction");
  if (!jurisdiction || !JURISDICTIONS.includes(jurisdiction)) fe.Jurisdiction = "Choose a state or Federal";
  const programType = str(fd, "programType") as ProgramType | null;
  if (programType && !(programType in PROGRAM_TYPE_LABELS)) fe.Type = "Invalid";
  const matchBasis = str(fd, "matchBasis") as MatchBasis | null;
  if (matchBasis && !(matchBasis in MATCH_BASIS_LABELS)) fe["Match basis"] = "Invalid";
  const minAward = dec(fd, "minAward");
  const maxAward = dec(fd, "maxAward");
  const matchPct = dec(fd, "matchPct");
  Object.assign(fe, badNumbers({ "Min award": minAward, "Max award": maxAward, "Match %": matchPct }));
  if (matchPct && matchPct !== "NaN" && (Number(matchPct) < 0 || Number(matchPct) > 1000)) fe["Match %"] = "Use a percentage, e.g. 50";
  if (minAward && maxAward && minAward !== "NaN" && maxAward !== "NaN" && Number(minAward) > Number(maxAward)) fe["Award range"] = "Min is above max";
  const r = str(fd, "reimbursement");
  return {
    fe,
    verified: bool(fd, "markVerified"),
    data: {
      name: name ?? "", jurisdiction: jurisdiction ?? "PA", agency: str(fd, "agency"), programType,
      eligibleApplicants: str(fd, "eligibleApplicants"), eligibleUses: str(fd, "eligibleUses"),
      minAward, maxAward, matchPct, matchBasis: matchPct ? matchBasis ?? "PROJECT_COST" : matchBasis, matchType: str(fd, "matchType"),
      reimbursement: r === "yes" ? true : r === "no" ? false : null,
      cycle: str(fd, "cycle"), nextDeadline: date(fd, "nextDeadline"), url: str(fd, "url"), notes: str(fd, "notes"), source: str(fd, "source"),
    },
  };
}

export async function createProgram(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditPrograms(user.role)) return { error: "Your role can view the program library but not add to it." };
  const { fe, data, verified } = parseProgram(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  let key = `${slug(data.jurisdiction)}-${slug(data.name)}`;
  if (await prisma.fundingProgram.findUnique({ where: { key } })) key += "-" + Date.now().toString(36);
  const p = await prisma.fundingProgram.create({
    data: { ...data, key, createdById: user.id, ...(verified ? { lastVerifiedAt: new Date(), lastVerifiedById: user.id } : {}) },
  });
  revalidatePath("/programs");
  redirect(`/programs/${p.id}`);
}

export async function updateProgram(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditPrograms(user.role)) return { error: "Your role can view the program library but not edit it." };
  const { fe, data, verified } = parseProgram(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  await prisma.fundingProgram.update({ where: { id }, data: { ...data, ...(verified ? { lastVerifiedAt: new Date(), lastVerifiedById: user.id } : {}) } });
  revalidatePath("/programs");
  revalidatePath(`/programs/${id}`);
  redirect(`/programs/${id}`);
}

export async function markProgramVerified(id: string) {
  const user = await requireUser();
  if (!canEditPrograms(user.role)) return;
  await prisma.fundingProgram.update({ where: { id }, data: { lastVerifiedAt: new Date(), lastVerifiedById: user.id } });
  revalidatePath("/programs");
  revalidatePath(`/programs/${id}`);
}

export async function deleteProgram(id: string): Promise<void> {
  const user = await requireUser();
  if (!canDelete(user.role)) throw new Error("Only admins and BD directors can delete programs.");
  const used = await prisma.capitalStackRow.count({ where: { programId: id } });
  if (used) redirect(`/programs/${id}?error=in-use`);
  await prisma.fundingProgram.delete({ where: { id } });
  revalidatePath("/programs");
  redirect("/programs");
}

/* ───── capital stack rows ───── */

async function revalidateOpp(oppId: string) {
  revalidatePath(`/opportunities/${oppId}`);
  revalidatePath("/programs");
  revalidatePath("/");
}

function parseRow(fd: FormData) {
  const fe: Record<string, string> = {};
  const amount = dec(fd, "amount");
  const lag = int(fd, "reimbursementLagDays");
  Object.assign(fe, badNumbers({ Amount: amount, "Reimbursement lag": lag }));
  if (amount && amount !== "NaN" && Number(amount) < 0) fe.Amount = "Can't be negative";
  const status = (str(fd, "status") ?? "IDEA") as StackStatus;
  if (!(status in STACK_STATUS_LABELS)) fe.Status = "Invalid";
  return {
    fe,
    data: {
      amount, status, reimbursementLagDays: lag, label: str(fd, "label"), notes: str(fd, "notes"),
      applicationDate: date(fd, "applicationDate"), awardDate: date(fd, "awardDate"),
    },
  };
}

/** Add a library program (programId) or another source (otherSource) to an opportunity's stack. */
export async function addStackRow(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) return { error: "Your role can't change capital stacks." };
  const opportunityId = str(fd, "opportunityId");
  const opp = opportunityId ? await prisma.opportunity.findUnique({ where: { id: opportunityId }, select: { id: true } }) : null;
  if (!opp) return { fieldErrors: { Opportunity: "Choose an opportunity" } };
  const programId = str(fd, "programId");
  const otherSource = str(fd, "otherSource") as OtherSource | null;
  if (!programId && !otherSource) return { fieldErrors: { Source: "Pick a library program or another source" } };
  if (programId && !(await prisma.fundingProgram.findUnique({ where: { id: programId }, select: { id: true } }))) return { fieldErrors: { Program: "Not found" } };
  if (otherSource && !(otherSource in OTHER_SOURCE_LABELS)) return { fieldErrors: { Source: "Invalid" } };
  const { fe, data } = parseRow(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const max = await prisma.capitalStackRow.aggregate({ where: { opportunityId: opp.id }, _max: { sortOrder: true } });
  await prisma.capitalStackRow.create({
    data: { ...data, opportunityId: opp.id, programId: programId ?? null, otherSource: programId ? null : otherSource, sortOrder: (max._max.sortOrder ?? 0) + 1, createdById: user.id },
  });
  await revalidateOpp(opp.id);
  if (fd.get("then") === "opp") redirect(`/opportunities/${opp.id}?tab=stack`);
  return undefined;
}

export async function updateStackRow(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) return { error: "Your role can't change capital stacks." };
  const { fe, data } = parseRow(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const r = await prisma.capitalStackRow.update({ where: { id }, data });
  await revalidateOpp(r.opportunityId);
  return undefined;
}

export async function deleteStackRow(id: string) {
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) return;
  const r = await prisma.capitalStackRow.delete({ where: { id } });
  await revalidateOpp(r.opportunityId);
}

/**
 * "Illustrative stack" starter (SPEC §4.6): adds placeholder rows for a typical mix of
 * sources with no amounts. The course's worked examples are not loaded into the app,
 * so no dollar figures are filled in.
 */
export async function addTemplateRows(opportunityId: string) {
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) return;
  const max = await prisma.capitalStackRow.aggregate({ where: { opportunityId }, _max: { sortOrder: true } });
  let n = max._max.sortOrder ?? 0;
  const rows: { otherSource: OtherSource; label: string }[] = [
    { otherSource: "OTHER", label: "State grant: replace with a library program" },
    { otherSource: "OTHER", label: "Federal grant: replace with a library program" },
    { otherSource: "BOND", label: "Bond or note" },
    { otherSource: "CAPITAL_RESERVE", label: "Capital reserve" },
  ];
  await prisma.capitalStackRow.createMany({ data: rows.map((r) => ({ ...r, opportunityId, sortOrder: ++n, createdById: user.id })) });
  await revalidateOpp(opportunityId);
}
