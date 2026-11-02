"use server";

import type { DeliveryMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { all, badNumbers, dec, int, str, type FormState } from "@/lib/forms";
import { canDelete, canEditAccounts } from "@/lib/permissions";
import { DELIVERY_METHODS } from "@/lib/pipeline";
import { requireUser } from "@/lib/session";

export async function saveProject(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditAccounts(user.role)) return { error: "Your role can view projects but not edit them." };
  const fe: Record<string, string> = {};
  const name = str(fd, "name");
  const orgId = str(fd, "orgId");
  if (!name) fe.Name = "Required";
  if (!orgId) fe.Owner = "Required";
  const companies = all(fd, "companies");
  if (!companies.length) fe.Company = "Tag at least one company";
  const dm = str(fd, "deliveryMethod") as DeliveryMethod | null;
  if (dm && !DELIVERY_METHODS.includes(dm)) fe["Delivery method"] = "Invalid";
  const n = { value: dec(fd, "value"), annualSavingsAchieved: dec(fd, "annualSavingsAchieved"), startYear: int(fd, "startYear"), completionYear: int(fd, "completionYear") };
  Object.assign(fe, badNumbers({ Value: n.value, Savings: n.annualSavingsAchieved, Start: n.startYear, Completion: n.completionYear }));
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const data = {
    name: name!, projectType: str(fd, "projectType"), deliveryMethod: dm, status: str(fd, "status") ?? "active",
    results: str(fd, "results"), photoUrls: str(fd, "photoUrls"), notes: str(fd, "notes"), ...n,
    org: { connect: { id: orgId! } },
    referenceContact: str(fd, "referenceContactId") ? { connect: { id: str(fd, "referenceContactId")! } } : id ? { disconnect: true } : undefined,
    opportunity: str(fd, "opportunityId") ? { connect: { id: str(fd, "opportunityId")! } } : undefined,
  };
  let pid = id;
  if (id) await prisma.project.update({ where: { id }, data: { ...data, companies: { set: companies.map((c) => ({ id: c })) } } });
  else pid = (await prisma.project.create({ data: { ...data, companies: { connect: companies.map((c) => ({ id: c })) }, createdBy: { connect: { id: user.id } } } })).id;
  revalidatePath("/projects");
  redirect(`/projects/${pid}`);
}

export async function deleteProject(id: string) {
  const user = await requireUser();
  if (!canDelete(user.role)) throw new Error("Only admins and BD directors can delete projects.");
  await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
  redirect("/projects");
}
