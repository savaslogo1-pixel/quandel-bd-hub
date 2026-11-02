// Server-side helpers shared by the import pages and actions.
import { randomUUID } from "crypto";
import type { ImportBatch, Prisma } from "@prisma/client";
import { PICKLISTS } from "../constants";
import { prisma } from "../db";
import { picklist } from "../picklists";
import { buildPreview, updateData, type Defaults, type ExistingOrg, type Mapping, type PreviewRow } from "./orgs";

export function parsed(b: ImportBatch) {
  return {
    headers: JSON.parse(b.headers) as string[],
    rows: JSON.parse(b.rows) as string[][],
    sheets: JSON.parse(b.sheetNames) as string[],
    mapping: (b.mapping ? JSON.parse(b.mapping) : {}) as Mapping,
    defaults: (b.defaults ? JSON.parse(b.defaults) : {}) as Defaults & { presetId?: string },
  };
}

export async function existingOrgs(): Promise<ExistingOrg[]> {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true, name: true, state: true, orgType: true, county: true, region: true, address: true, website: true, tier: true, status: true,
      population: true, enrollment: true, annualBudget: true, debtOutstanding: true, debtLimit: true, buildingCount: true,
      oldestBuildingYear: true, lastMajorRenovationYear: true, lastEnergyProjectYear: true, lastEnergyProjectEsco: true,
      capitalPlanUrl: true, recentBondIssues: true, creditRating: true, fiscalStressStatus: true, governingBody: true,
      arcCounty: true, quandelTerritory: true, energyCommunity: true, notes: true, companies: { select: { code: true } },
    },
  });
  return orgs.map(({ companies, annualBudget, debtOutstanding, debtLimit, ...o }) => ({
    ...o,
    annualBudget: annualBudget != null ? Number(annualBudget) : null,
    debtOutstanding: debtOutstanding != null ? Number(debtOutstanding) : null,
    debtLimit: debtLimit != null ? Number(debtLimit) : null,
    companyCodes: companies.map((c) => c.code),
  }));
}

export async function previewFor(b: ImportBatch, existing?: ExistingOrg[]) {
  const { headers, rows, mapping, defaults } = parsed(b);
  const [types, cos] = await Promise.all([picklist(PICKLISTS.orgType), prisma.company.findMany({ select: { code: true } })]);
  return buildPreview({
    headers, rows, headerRow: b.headerRow, mapping, defaults, allowedTypes: types,
    companyCodes: cos.map((c) => c.code), existing: existing ?? (await existingOrgs()), currentYear: new Date().getUTCFullYear(),
  });
}

const money = (v: unknown) => (v == null ? null : String(v));

/** Write the preview: create new organizations and update matched ones. */
export async function commitBatch(b: ImportBatch, userId: string) {
  const existing = await existingOrgs();
  const byId = new Map(existing.map((e) => [e.id, e]));
  const { rows } = await previewFor(b, existing);
  const { defaults } = parsed(b);
  const onDup = defaults.onDuplicate ?? "fill";
  const cos = await prisma.company.findMany({ select: { id: true, code: true } });
  const coId = Object.fromEntries(cos.map((c) => [c.code, c.id]));
  const source = defaults.source || `${b.fileName}${b.sheetName ? ` · ${b.sheetName}` : ""}`;

  const creates: { data: Prisma.OrganizationCreateManyInput; companyCodes: string[] }[] = rows
    .filter((r) => r.action === "create")
    .map((r) => {
      const d = r.draft;
      return {
        companyCodes: d.companyCodes ?? [],
        data: {
          id: randomUUID(), name: d.name!, orgType: d.orgType!, state: d.state!, county: d.county ?? null, region: d.region ?? null,
          address: d.address ?? null, website: d.website ?? null, tier: d.tier ?? null, status: d.status ?? "TARGET",
          population: d.population ?? null, enrollment: d.enrollment ?? null, annualBudget: money(d.annualBudget), debtOutstanding: money(d.debtOutstanding), debtLimit: money(d.debtLimit),
          buildingCount: d.buildingCount ?? null, oldestBuildingYear: d.oldestBuildingYear ?? null, lastMajorRenovationYear: d.lastMajorRenovationYear ?? null,
          lastEnergyProjectYear: d.lastEnergyProjectYear ?? null, lastEnergyProjectEsco: d.lastEnergyProjectEsco ?? null, capitalPlanUrl: d.capitalPlanUrl ?? null,
          recentBondIssues: d.recentBondIssues ?? null, creditRating: d.creditRating ?? null, fiscalStressStatus: d.fiscalStressStatus ?? null,
          governingBody: d.governingBody ?? null, arcCounty: d.arcCounty ?? false, quandelTerritory: d.quandelTerritory ?? false,
          energyCommunity: d.energyCommunity ?? false, notes: d.notes ?? null, source, importBatchId: b.id, createdById: userId,
        },
      };
    });
  for (let i = 0; i < creates.length; i += 500) await prisma.organization.createMany({ data: creates.slice(i, i + 500).map((c) => c.data) });
  const tagged = creates.filter((c) => c.companyCodes.length);
  for (let i = 0; i < tagged.length; i += 100)
    await prisma.$transaction(tagged.slice(i, i + 100).map((c) => prisma.organization.update({ where: { id: c.data.id! }, data: { companies: { connect: c.companyCodes.filter((x) => coId[x]).map((x) => ({ id: coId[x] })) } } })));

  const updates = rows.filter((r): r is PreviewRow & { matchId: string } => r.action === "update" && !!r.matchId && byId.has(r.matchId));
  for (let i = 0; i < updates.length; i += 100)
    await prisma.$transaction(updates.slice(i, i + 100).map((r) => {
      const ex = byId.get(r.matchId)!;
      const add = (r.draft.companyCodes ?? []).filter((c) => !ex.companyCodes.includes(c) && coId[c]);
      return prisma.organization.update({
        where: { id: r.matchId },
        data: { ...(updateData(r, ex, onDup) as Prisma.OrganizationUpdateInput), ...(add.length ? { companies: { connect: add.map((c) => ({ id: coId[c] })) } } : {}) },
      });
    }));

  const counts = { created: creates.length, updated: updates.length, skipped: rows.filter((r) => r.action === "skip").length, errors: rows.filter((r) => r.action === "error").length };
  await prisma.importBatch.update({ where: { id: b.id }, data: { ...counts, status: "COMMITTED", committedAt: new Date(), fileData: null, createdById: b.createdById ?? userId } });
  return counts;
}
