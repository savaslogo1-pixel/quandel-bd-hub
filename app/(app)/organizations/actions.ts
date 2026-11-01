"use server";

import { Prisma, type OrgStatus, type StateCode, type Tier } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STATES, TIERS, PICKLISTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { all, badNumbers, bool, date, dec, int, str, type FormState } from "@/lib/forms";
import { canDelete, canEditAccounts } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

const STATUSES: OrgStatus[] = ["TARGET", "ACTIVE", "CLIENT", "DORMANT", "DO_NOT_PURSUE"];

async function parse(fd: FormData) {
  const fe: Record<string, string> = {};
  const name = str(fd, "name");
  const orgType = str(fd, "orgType");
  const state = str(fd, "state") as StateCode | null;
  if (!name) fe.Name = "Required";
  if (!orgType) fe.Type = "Required";
  else if (!(await prisma.picklistValue.findFirst({ where: { list: PICKLISTS.orgType, value: orgType } }))) fe.Type = "Not in the org-type list";
  if (!state || !STATES.includes(state)) fe.State = "Required";
  const tier = str(fd, "tier") as Tier | null;
  if (tier && !TIERS.includes(tier)) fe.Tier = "Choose A, B or C";
  const status = (str(fd, "status") ?? "TARGET") as OrgStatus;
  if (!STATUSES.includes(status)) fe.Status = "Invalid";

  const n = {
    population: int(fd, "population"), enrollment: int(fd, "enrollment"),
    buildingCount: int(fd, "buildingCount"), oldestBuildingYear: int(fd, "oldestBuildingYear"),
    lastMajorRenovationYear: int(fd, "lastMajorRenovationYear"), lastEnergyProjectYear: int(fd, "lastEnergyProjectYear"),
    agendaDeadlineDays: int(fd, "agendaDeadlineDays"), meetingWeekday: int(fd, "meetingWeekday"),
    annualBudget: dec(fd, "annualBudget"), debtOutstanding: dec(fd, "debtOutstanding"), debtLimit: dec(fd, "debtLimit"),
  };
  Object.assign(fe, badNumbers(n));
  const weeks = all(fd, "meetingWeeksOfMonth").map(Number).filter((w) => w >= 1 && w <= 5).sort();
  if (weeks.length && n.meetingWeekday == null) fe["Meeting day"] = "Pick the weekday the board meets";

  const parentOrgId = str(fd, "parentOrgId");
  const ownerId = str(fd, "relationshipOwnerId");
  const companyIds = all(fd, "companies");

  const data = {
    name: name ?? "", orgType: orgType ?? "", state: (state ?? "PA") as StateCode,
    county: str(fd, "county"), region: str(fd, "region"), address: str(fd, "address"), website: str(fd, "website"),
    arcCounty: bool(fd, "arcCounty"), energyCommunity: bool(fd, "energyCommunity"),
    opportunityZoneTract: bool(fd, "opportunityZoneTract"), disadvantagedCommunity: bool(fd, "disadvantagedCommunity"),
    fiscalStressStatus: str(fd, "fiscalStressStatus"),
    population: n.population, enrollment: n.enrollment, fiscalYearStart: str(fd, "fiscalYearStart"),
    annualBudget: n.annualBudget, debtOutstanding: n.debtOutstanding, debtLimit: n.debtLimit,
    recentBondIssues: str(fd, "recentBondIssues"), creditRating: str(fd, "creditRating"),
    taxCapOverrideHistory: str(fd, "taxCapOverrideHistory"),
    buildingCount: n.buildingCount, oldestBuildingYear: n.oldestBuildingYear,
    lastMajorRenovationYear: n.lastMajorRenovationYear, lastEnergyProjectYear: n.lastEnergyProjectYear,
    lastEnergyProjectEsco: str(fd, "lastEnergyProjectEsco"), capitalPlanUrl: str(fd, "capitalPlanUrl"),
    capitalPlanDate: date(fd, "capitalPlanDate"), buildingConditionSurveyDate: date(fd, "buildingConditionSurveyDate"),
    governingBody: str(fd, "governingBody"), meetingWeekday: n.meetingWeekday,
    meetingWeeksOfMonth: weeks.length ? weeks.join(",") : null, meetingPatternNote: str(fd, "meetingPatternNote"),
    agendaDeadlineDays: n.agendaDeadlineDays, voteRules: str(fd, "voteRules"), permissiveReferendum: bool(fd, "permissiveReferendum"),
    tier, status, source: str(fd, "source"),
  };
  return { fe, data, parentOrgId, ownerId, companyIds };
}

function uniqueError(e: unknown): FormState | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
    return { error: "An organization with this name, state and type already exists." };
  return null;
}

export async function createOrganization(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditAccounts(user.role)) return { error: "Your role can view organizations but not add them." };
  const { fe, data, parentOrgId, ownerId, companyIds } = await parse(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  let id: string;
  try {
    const org = await prisma.organization.create({
      data: {
        ...data,
        parentOrg: parentOrgId ? { connect: { id: parentOrgId } } : undefined,
        relationshipOwner: ownerId ? { connect: { id: ownerId } } : undefined,
        companies: { connect: companyIds.map((id) => ({ id })) },
        createdBy: { connect: { id: user.id } },
      },
    });
    id = org.id;
  } catch (e) {
    const u = uniqueError(e);
    if (u) return u;
    throw e;
  }
  revalidatePath("/organizations");
  redirect(`/organizations/${id}`);
}

export async function updateOrganization(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditAccounts(user.role)) return { error: "Your role can view organizations but not edit them." };
  const { fe, data, parentOrgId, ownerId, companyIds } = await parse(fd);
  if (parentOrgId === id) fe["Parent org"] = "An organization can't be its own parent";
  if (Object.keys(fe).length) return { fieldErrors: fe };
  try {
    await prisma.organization.update({
      where: { id },
      data: {
        ...data,
        parentOrg: parentOrgId ? { connect: { id: parentOrgId } } : { disconnect: true },
        relationshipOwner: ownerId ? { connect: { id: ownerId } } : { disconnect: true },
        companies: { set: companyIds.map((id) => ({ id })) },
      },
    });
  } catch (e) {
    const u = uniqueError(e);
    if (u) return u;
    throw e;
  }
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${id}`);
  redirect(`/organizations/${id}`);
}

export async function deleteOrganization(id: string) {
  const user = await requireUser();
  if (!canDelete(user.role)) throw new Error("Only admins and BD directors can delete organizations.");
  await prisma.organization.delete({ where: { id } });
  revalidatePath("/organizations");
  redirect("/organizations");
}
