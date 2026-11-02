"use server";

import { revalidatePath } from "next/cache";
import { STATES } from "@/lib/constants";
import { GIFT_KINDS } from "@/lib/compliance";
import { prisma } from "@/lib/db";
import { badNumbers, date, dec, str, type FormState } from "@/lib/forms";
import { canReviewCompliance } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { attestedThisYear } from "@/lib/training/progress";

async function attestedUser() {
  const u = await requireUser();
  if (!(await attestedThisYear(u.id))) throw new Error("Sign this year's ethics attestation (Training → My learning) before logging gifts or lobbying.");
  return u;
}
const refresh = () => revalidatePath("/compliance", "layout");

export async function logGift(_: FormState, fd: FormData): Promise<FormState> {
  let u;
  try { u = await attestedUser(); } catch (e) { return { error: (e as Error).message }; }
  const fe: Record<string, string> = {};
  const d = date(fd, "date"), value = dec(fd, "value"), state = str(fd, "state"), recipientName = str(fd, "recipientName"), description = str(fd, "description");
  const kind = str(fd, "kind") ?? "gift";
  if (!d) fe.Date = "Required";
  if (value == null) fe.Value = "Enter the value, even if $0";
  Object.assign(fe, badNumbers({ Value: value }));
  if (!state || !STATES.includes(state as never)) fe.Jurisdiction = "Pick the state whose rules apply";
  if (!recipientName) fe.Recipient = "Required";
  if (!description) fe.Description = "Required";
  if (!GIFT_KINDS.includes(kind)) fe.Kind = "Invalid";
  const approverId = str(fd, "approverId");
  if (approverId === u.id) fe.Approver = "Someone other than you approves it";
  if (Object.keys(fe).length) return { fieldErrors: fe };
  await prisma.giftEntry.create({
    data: { date: d!, kind, description: description!, value: value!, state: state!, recipientName: recipientName!, recipientContactId: str(fd, "recipientContactId"), orgId: str(fd, "orgId"), giverId: u.id, approverId },
  });
  refresh();
  return undefined;
}

export async function reviewGift(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  if (!canReviewCompliance(u.role)) return { error: "Compliance, BD directors and admins review gifts." };
  await prisma.giftEntry.update({ where: { id }, data: { reviewedById: u.id, reviewedAt: new Date(), reviewNote: str(fd, "reviewNote") } });
  refresh();
  return undefined;
}

export async function deleteGift(id: string) {
  const u = await requireUser();
  const g = await prisma.giftEntry.findUnique({ where: { id } });
  if (!g) return;
  if (!(canReviewCompliance(u.role) || (g.giverId === u.id && !g.reviewedAt))) throw new Error("Not allowed.");
  await prisma.giftEntry.delete({ where: { id } });
  refresh();
}

export async function logLobbying(_: FormState, fd: FormData): Promise<FormState> {
  let u;
  try { u = await attestedUser(); } catch (e) { return { error: (e as Error).message }; }
  const fe: Record<string, string> = {};
  const d = date(fd, "date"), hours = dec(fd, "hours"), expenses = dec(fd, "expenses"), jurisdiction = str(fd, "jurisdiction"), subject = str(fd, "subject");
  if (!d) fe.Date = "Required";
  if (hours == null) fe.Hours = "Required (0 if none)";
  Object.assign(fe, badNumbers({ Hours: hours, Amount: expenses }));
  if (!jurisdiction || !STATES.includes(jurisdiction as never)) fe.Jurisdiction = "Required";
  if (!subject) fe.Subject = "What was lobbied on";
  if (Object.keys(fe).length) return { fieldErrors: fe };
  await prisma.lobbyingEntry.create({ data: { date: d!, hours: hours!, expenses: expenses ?? "0", jurisdiction: jurisdiction!, subject: subject!, officials: str(fd, "officials"), notes: str(fd, "notes"), userId: u.id } });
  refresh();
  return undefined;
}

export async function deleteLobbying(id: string) {
  const u = await requireUser();
  const l = await prisma.lobbyingEntry.findUnique({ where: { id } });
  if (!l) return;
  if (!(canReviewCompliance(u.role) || l.userId === u.id)) throw new Error("Not allowed.");
  await prisma.lobbyingEntry.delete({ where: { id } });
  refresh();
}
