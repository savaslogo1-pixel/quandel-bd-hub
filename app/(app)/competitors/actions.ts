"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { linkCompetitorProjects } from "@/lib/competitors";
import { COMPETITOR_CATEGORIES } from "@/lib/competitorLabels";
import { prisma } from "@/lib/db";
import { all, badNumbers, dec, int, str, type FormState } from "@/lib/forms";
import { canEditAccounts } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

async function guard() {
  const u = await requireUser();
  if (!canEditAccounts(u.role)) throw new Error("Your role can view competitors but not edit them.");
  return u;
}

export async function saveCompetitor(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  await guard();
  const name = str(fd, "name");
  if (!name) return { fieldErrors: { Name: "Required" } };
  const data = {
    name, kind: str(fd, "kind"), aliases: str(fd, "aliases"), website: str(fd, "website"), headquarters: str(fd, "headquarters"),
    ownership: str(fd, "ownership"), profile: str(fd, "profile"), pricingNotes: str(fd, "pricingNotes"), howTheyWin: str(fd, "howTheyWin"),
    ourResponse: str(fd, "ourResponse"), source: str(fd, "source"),
  };
  const companies = all(fd, "competesWith");
  let cid = id;
  if (id) await prisma.competitor.update({ where: { id }, data: { ...data, competesWith: { set: companies.map((c) => ({ id: c })) } } });
  else {
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    cid = (await prisma.competitor.create({ data: { ...data, key, competesWith: { connect: companies.map((c) => ({ id: c })) } } })).id;
  }
  revalidatePath("/competitors");
  redirect(`/competitors/${cid}`);
}

export async function addCompetitorProject(competitorId: string, _: FormState, fd: FormData): Promise<FormState> {
  await guard();
  const ownerName = str(fd, "ownerName");
  const description = str(fd, "description");
  const category = str(fd, "category") ?? "other";
  const fe: Record<string, string> = {};
  if (!ownerName) fe.Owner = "Required";
  if (!description) fe.What = "Required";
  if (!(category in COMPETITOR_CATEGORIES)) fe.Category = "Invalid";
  const value = dec(fd, "value");
  const year = int(fd, "year");
  Object.assign(fe, badNumbers({ Value: value, Year: year }));
  if (Object.keys(fe).length) return { fieldErrors: fe };
  await prisma.competitorProject.create({
    data: { competitorId, ownerName: ownerName!, county: str(fd, "county"), state: str(fd, "state") ?? "PA", category, description: description!, when: str(fd, "when"), year, value, sourceTitle: str(fd, "sourceTitle"), sourceUrl: str(fd, "sourceUrl") },
  });
  await linkCompetitorProjects();
  revalidatePath(`/competitors/${competitorId}`);
  return undefined;
}

export async function deleteCompetitorProject(id: string) {
  await guard();
  const p = await prisma.competitorProject.delete({ where: { id } });
  revalidatePath(`/competitors/${p.competitorId}`);
}

export async function linkProjects(competitorId: string) {
  await guard();
  await linkCompetitorProjects();
  revalidatePath(`/competitors/${competitorId}`);
}

export async function setProjectOrg(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await guard();
  const orgId = str(fd, "orgId");
  const p = await prisma.competitorProject.update({ where: { id }, data: { orgId } });
  revalidatePath(`/competitors/${p.competitorId}`);
  return undefined;
}
