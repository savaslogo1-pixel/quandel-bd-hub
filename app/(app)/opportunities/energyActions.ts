"use server";

import type { MvStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { badNumbers, bool, date, dec, int, str, type FormState } from "@/lib/forms";
import { canEditOpportunities } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

async function guard() {
  const u = await requireUser();
  if (!canEditOpportunities(u.role)) throw new Error("Your role can't change energy models.");
  return u;
}
const refresh = (oppId: string) => revalidatePath(`/opportunities/${oppId}`);

export async function saveEnergyTerms(oppId: string, _: FormState, fd: FormData): Promise<FormState> {
  await guard();
  const v = {
    guaranteeTermYears: int(fd, "guaranteeTermYears"), financingRatePct: dec(fd, "financingRatePct"),
    nonEnergyCost: dec(fd, "nonEnergyCost"), otherFunding: dec(fd, "otherFunding"), guaranteedSavingsOverride: dec(fd, "guaranteedSavingsOverride"),
  };
  const fe = badNumbers({ Term: v.guaranteeTermYears, Rate: v.financingRatePct, "Non-energy cost": v.nonEnergyCost, "Other funding": v.otherFunding, "Guaranteed savings": v.guaranteedSavingsOverride });
  if (v.guaranteeTermYears != null && !Number.isNaN(v.guaranteeTermYears) && (v.guaranteeTermYears < 1 || v.guaranteeTermYears > 40)) fe.Term = "Use 1 to 40 years";
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const ipmvp = str(fd, "ipmvpOption");
  if (ipmvp && !["A", "B", "C", "D"].includes(ipmvp)) return { fieldErrors: { IPMVP: "A, B, C or D" } };
  await prisma.opportunity.update({ where: { id: oppId }, data: { ...v, ipmvpOption: ipmvp } });
  refresh(oppId);
  return undefined;
}

function parseMeasure(fd: FormData) {
  const name = str(fd, "name");
  const d = {
    cost: dec(fd, "cost"), annualSavings: dec(fd, "annualSavings"), electivePayAmount: dec(fd, "electivePayAmount"),
    annualKwhSaved: int(fd, "annualKwhSaved"), annualThermsSaved: int(fd, "annualThermsSaved"), usefulLifeYears: int(fd, "usefulLifeYears"),
  };
  const fe = badNumbers({ Cost: d.cost, Savings: d.annualSavings, "Elective pay": d.electivePayAmount, kWh: d.annualKwhSaved, Therms: d.annualThermsSaved, Life: d.usefulLifeYears });
  if (!name) fe.Measure = "Name the measure";
  return { fe, data: { ...d, name: name ?? "", category: str(fd, "category"), electivePayEligible: bool(fd, "electivePayEligible"), notes: str(fd, "notes") } };
}

export async function addMeasure(oppId: string, _: FormState, fd: FormData): Promise<FormState> {
  const u = await guard();
  const { fe, data } = parseMeasure(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const max = await prisma.energyMeasure.aggregate({ where: { opportunityId: oppId }, _max: { sortOrder: true } });
  await prisma.energyMeasure.create({ data: { ...data, opportunityId: oppId, sortOrder: (max._max.sortOrder ?? 0) + 1, createdById: u.id } });
  refresh(oppId);
  return undefined;
}

export async function updateMeasure(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await guard();
  const { fe, data } = parseMeasure(fd);
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const m = await prisma.energyMeasure.update({ where: { id }, data });
  refresh(m.opportunityId);
  return undefined;
}

export async function deleteMeasure(id: string) {
  await guard();
  const m = await prisma.energyMeasure.delete({ where: { id } });
  refresh(m.opportunityId);
}

/** M&V schedule: one report per guarantee year, due each year after the start date. */
export async function createMvSchedule(oppId: string, _: FormState, fd: FormData): Promise<FormState> {
  await guard();
  const start = date(fd, "start");
  const years = int(fd, "years");
  const guaranteed = dec(fd, "guaranteed");
  if (!start) return { fieldErrors: { Start: "Pick when the guarantee starts (e.g. substantial completion)" } };
  if (years == null || Number.isNaN(years) || years < 1 || years > 40) return { fieldErrors: { Years: "1 to 40" } };
  for (let y = 1; y <= years; y++) {
    const due = new Date(Date.UTC(start.getUTCFullYear() + y, start.getUTCMonth(), start.getUTCDate()));
    await prisma.mvReport.upsert({ where: { opportunityId_year: { opportunityId: oppId, year: y } }, update: {}, create: { opportunityId: oppId, year: y, dueDate: due, guaranteedSavings: guaranteed === "NaN" ? null : guaranteed } });
  }
  refresh(oppId);
  return undefined;
}

export async function updateMv(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await guard();
  const actual = dec(fd, "actualSavings");
  const guaranteed = dec(fd, "guaranteedSavings");
  const fe = badNumbers({ Actual: actual, Guaranteed: guaranteed });
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const status = (str(fd, "status") ?? "DUE") as MvStatus;
  const r = await prisma.mvReport.update({ where: { id }, data: { actualSavings: actual, guaranteedSavings: guaranteed, status, notes: str(fd, "notes"), dueDate: date(fd, "dueDate") ?? undefined } });
  refresh(r.opportunityId);
  return undefined;
}
