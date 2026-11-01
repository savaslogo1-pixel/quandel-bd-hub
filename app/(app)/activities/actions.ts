"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PICKLISTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { all, bool, date, str, type FormState } from "@/lib/forms";
import { canDelete, canLogActivity } from "@/lib/permissions";
import { requireUser, type CurrentUser } from "@/lib/session";

async function parse(fd: FormData, orgId: string) {
  const fe: Record<string, string> = {};
  const type = str(fd, "type");
  if (!type) fe.Type = "Required";
  else if (!(await prisma.picklistValue.findFirst({ where: { list: PICKLISTS.activityType, value: type } }))) fe.Type = "Not in the activity-type list";
  const occurredAt = date(fd, "occurredAt");
  if (!occurredAt) fe.Date = "Required";
  const companyIds = all(fd, "companies");
  if (!companyIds.length) fe.Company = "Tag at least one company";
  const contactIds = all(fd, "contacts");
  const okContacts = await prisma.contact.findMany({ where: { id: { in: contactIds }, orgId }, select: { id: true } });
  const nextStep = str(fd, "nextStep");
  const nextStepDate = date(fd, "nextStepDate");
  if (nextStepDate && !nextStep) fe["Next step"] = "Describe the next step for that date";

  // Municipal-advisor flag (SPEC §4.14): financing talk must be tied to the owner's financial advisor.
  const financingDiscussed = bool(fd, "financingDiscussed");
  const faId = str(fd, "financialAdvisorContactId");
  if (financingDiscussed && !faId) fe["Financial advisor"] = "Financing was discussed: link the owner's financial advisor. If they aren't in the CRM yet, add them as a contact with function \"financial advisor\".";
  if (faId && !(await prisma.contact.findUnique({ where: { id: faId }, select: { id: true } }))) fe["Financial advisor"] = "Contact not found";

  return {
    fe,
    contactIds: okContacts.map((c) => c.id),
    companyIds,
    faId: financingDiscussed ? faId : null,
    data: {
      type: type ?? "", occurredAt: occurredAt ?? new Date(), notes: str(fd, "notes"),
      nextStep, nextStepDate, nextStepDone: bool(fd, "nextStepDone"),
      agendaItems: str(fd, "agendaItems"), votesTaken: str(fd, "votesTaken"), minutesUrl: str(fd, "minutesUrl"),
      financingDiscussed,
    },
  };
}

/** Logging an activity with contacts moves their "last touch" forward. */
async function touchContacts(ids: string[], when: Date) {
  if (!ids.length) return;
  await prisma.contact.updateMany({ where: { id: { in: ids }, OR: [{ lastTouch: null }, { lastTouch: { lt: when } }] }, data: { lastTouch: when } });
}

export async function createActivity(orgId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canLogActivity(user.role)) return { error: "Your role can't log activities." };
  if (!(await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } }))) return { error: "Organization not found." };
  const { fe, data, contactIds, companyIds, faId } = await parse(fd, orgId);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  await prisma.activity.create({
    data: {
      ...data,
      org: { connect: { id: orgId } },
      contacts: { connect: contactIds.map((id) => ({ id })) },
      companies: { connect: companyIds.map((id) => ({ id })) },
      financialAdvisorContact: faId ? { connect: { id: faId } } : undefined,
      createdBy: { connect: { id: user.id } },
    },
  });
  await touchContacts(contactIds, data.occurredAt);
  revalidatePath(`/organizations/${orgId}`);
  revalidatePath("/activities");
  revalidatePath("/");
  redirect(`/organizations/${orgId}?tab=activities`);
}

function canChange(user: CurrentUser, createdById: string | null) {
  return createdById === user.id || canDelete(user.role);
}

export async function updateActivity(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const a = await prisma.activity.findUnique({ where: { id } });
  if (!a) return { error: "Activity not found." };
  if (!canChange(user, a.createdById)) return { error: "Only the person who logged this activity (or an admin or BD director) can edit it." };
  const { fe, data, contactIds, companyIds, faId } = await parse(fd, a.orgId);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  await prisma.activity.update({
    where: { id },
    data: {
      ...data,
      contacts: { set: contactIds.map((i) => ({ id: i })) },
      companies: { set: companyIds.map((i) => ({ id: i })) },
      financialAdvisorContact: faId ? { connect: { id: faId } } : { disconnect: true },
    },
  });
  await touchContacts(contactIds, data.occurredAt);
  revalidatePath(`/organizations/${a.orgId}`);
  revalidatePath("/activities");
  revalidatePath("/");
  redirect(`/organizations/${a.orgId}?tab=activities`);
}

export async function deleteActivity(id: string) {
  const user = await requireUser();
  const a = await prisma.activity.findUnique({ where: { id } });
  if (!a) redirect("/activities");
  if (!canChange(user, a.createdById)) throw new Error("Not allowed to delete this activity.");
  await prisma.activity.delete({ where: { id } });
  revalidatePath(`/organizations/${a.orgId}`);
  redirect(`/organizations/${a.orgId}?tab=activities`);
}

export async function markNextStepDone(id: string) {
  const user = await requireUser();
  const a = await prisma.activity.findUnique({ where: { id } });
  if (!a || !canChange(user, a.createdById)) return;
  await prisma.activity.update({ where: { id }, data: { nextStepDone: true } });
  revalidatePath("/");
  revalidatePath("/activities");
}
