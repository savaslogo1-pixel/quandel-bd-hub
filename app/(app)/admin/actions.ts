"use server";

import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { all, bool, str, type FormState } from "@/lib/forms";
import { ROLE_LABELS, isAdmin } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

async function requireAdmin() {
  const u = await requireUser();
  if (!isAdmin(u.role)) throw new Error("Admins only.");
  return u;
}

export async function updateUser(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const role = str(fd, "role") as Role | null;
  if (!role || !(role in ROLE_LABELS)) return { error: "Choose a role." };
  const active = bool(fd, "active");
  if (id === me.id && (role !== "ADMIN" || !active)) {
    const admins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (admins <= 1) return { error: "You are the only admin. Make someone else an admin first." };
  }
  await prisma.user.update({ where: { id }, data: { role, active, name: str(fd, "name"), companies: { set: all(fd, "companies").map((c) => ({ id: c })) } } });
  revalidatePath("/admin");
  return { error: undefined };
}

export async function addPicklistValue(list: string, _: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const value = str(fd, "value");
  if (!value) return { error: "Enter a value." };
  const exists = await prisma.picklistValue.findUnique({ where: { list_value: { list, value } } });
  if (exists) {
    await prisma.picklistValue.update({ where: { id: exists.id }, data: { active: true } });
  } else {
    const max = await prisma.picklistValue.aggregate({ where: { list }, _max: { sortOrder: true } });
    await prisma.picklistValue.create({ data: { list, value, label: value, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  }
  revalidatePath("/admin");
  return undefined;
}

export async function togglePicklistValue(id: string) {
  await requireAdmin();
  const v = await prisma.picklistValue.findUnique({ where: { id } });
  if (!v) return;
  await prisma.picklistValue.update({ where: { id }, data: { active: !v.active } });
  revalidatePath("/admin");
}
