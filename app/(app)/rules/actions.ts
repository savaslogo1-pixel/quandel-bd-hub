"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { badNumbers, bool, dec, str, type FormState } from "@/lib/forms";
import { canEditRules } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export async function updateRule(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditRules(user.role)) return { error: "State rules are edited by compliance, a BD director or an admin." };
  const text = str(fd, "text");
  if (!text) return { fieldErrors: { Rule: "Required" } };
  const value = dec(fd, "value");
  const fe = badNumbers({ Value: value });
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const source = str(fd, "source");
  const verified = bool(fd, "markVerified");
  if (verified && !source) return { fieldErrors: { Source: "Cite the statute or guidance you checked" } };
  await prisma.stateRule.update({
    where: { id },
    data: { text, value, unit: str(fd, "unit"), source, topic: str(fd, "topic") ?? "General", ...(verified ? { lastVerifiedAt: new Date(), lastVerifiedById: user.id } : {}) },
  });
  revalidatePath("/rules");
  return undefined;
}

export async function createRule(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canEditRules(user.role)) return { error: "State rules are added by compliance, a BD director or an admin." };
  const key = str(fd, "key");
  const jurisdiction = str(fd, "jurisdiction");
  const text = str(fd, "text");
  const fe: Record<string, string> = {};
  if (!key || !/^[A-Za-z]+\.[a-z0-9_]+$/.test(key)) fe.Key = 'Use STATE.name_in_snake_case, e.g. "MD.prevailing_wage_threshold"';
  if (!jurisdiction) fe.Jurisdiction = "Required";
  if (!text) fe.Rule = "Required";
  const value = dec(fd, "value");
  Object.assign(fe, badNumbers({ Value: value }));
  if (key && (await prisma.stateRule.findUnique({ where: { key } }))) fe.Key = "Already exists";
  if (Object.keys(fe).length) return { fieldErrors: fe };
  await prisma.stateRule.create({ data: { key: key!, jurisdiction: jurisdiction!, text: text!, value, unit: str(fd, "unit"), source: str(fd, "source"), topic: str(fd, "topic") ?? "General", createdById: user.id } });
  revalidatePath("/rules");
  return undefined;
}
