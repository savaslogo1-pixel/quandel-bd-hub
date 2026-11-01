"use server";

import type { DecisionRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DECISION_ROLES, PICKLISTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { all, badNumbers, bool, date, int, str, type FormState } from "@/lib/forms";
import { canDelete, canEditAccounts } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

async function parse(fd: FormData, selfId?: string) {
  const fe: Record<string, string> = {};
  const name = str(fd, "name");
  const orgId = str(fd, "orgId");
  if (!name) fe.Name = "Required";
  if (!orgId || !(await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } }))) fe.Organization = "Required";
  const decisionRole = str(fd, "decisionRole") as DecisionRole | null;
  if (decisionRole && !DECISION_ROLES.includes(decisionRole)) fe["Decision role"] = "Invalid";
  const strength = int(fd, "relationshipStrength");
  Object.assign(fe, badNumbers({ "Relationship strength": strength }));
  if (strength != null && !Number.isNaN(strength) && (strength < 1 || strength > 5)) fe["Relationship strength"] = "Use 1 to 5";
  const email = str(fd, "email");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fe.Email = "Check the address";
  const fn = str(fd, "function");
  if (fn && !(await prisma.picklistValue.findFirst({ where: { list: PICKLISTS.contactFunction, value: fn } }))) fe.Function = "Not in the list";

  // Influence links stay inside the same organization and never point at the contact itself.
  const influenceIds = all(fd, "influences").filter((i) => i !== selfId);
  const valid = orgId ? await prisma.contact.findMany({ where: { id: { in: influenceIds }, orgId }, select: { id: true } }) : [];

  return {
    fe,
    orgId: orgId ?? "",
    influenceIds: valid.map((v) => v.id),
    data: {
      name: name ?? "", title: str(fd, "title"), email, phone: str(fd, "phone"), linkedinUrl: str(fd, "linkedinUrl"),
      decisionRole, function: fn, relationshipStrength: strength,
      lastTouch: date(fd, "lastTouch"), nextTouch: date(fd, "nextTouch"), preferredChannel: str(fd, "preferredChannel"),
      optOut: bool(fd, "optOut"), doNotContact: bool(fd, "doNotContact"),
    },
  };
}

export async function createContact(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditAccounts(user.role)) return { error: "Your role can view contacts but not add them." };
  const { fe, data, orgId, influenceIds } = await parse(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const c = await prisma.contact.create({
    data: { ...data, org: { connect: { id: orgId } }, influences: { connect: influenceIds.map((id) => ({ id })) }, createdBy: { connect: { id: user.id } } },
  });
  revalidatePath(`/organizations/${orgId}`);
  redirect(fd.get("then") === "another" ? `/contacts/new?org=${orgId}&added=${encodeURIComponent(c.name)}` : `/organizations/${orgId}?tab=contacts`);
}

export async function updateContact(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditAccounts(user.role)) return { error: "Your role can view contacts but not edit them." };
  const { fe, data, orgId, influenceIds } = await parse(fd, id);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  await prisma.contact.update({
    where: { id },
    data: { ...data, org: { connect: { id: orgId } }, influences: { set: influenceIds.map((i) => ({ id: i })) } },
  });
  revalidatePath(`/contacts/${id}`);
  revalidatePath(`/organizations/${orgId}`);
  redirect(`/contacts/${id}`);
}

export async function deleteContact(id: string) {
  const user = await requireUser();
  if (!canDelete(user.role)) throw new Error("Only admins and BD directors can delete contacts.");
  const c = await prisma.contact.delete({ where: { id } });
  revalidatePath(`/organizations/${c.orgId}`);
  redirect(`/organizations/${c.orgId}?tab=contacts`);
}
