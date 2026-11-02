"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { all, badNumbers, dec, str, type FormState } from "@/lib/forms";
import { guessBridgeMapping } from "@/lib/import/bridges";
import { bridgePreview } from "@/lib/import/bridgeRun";
import { detectHeaderRow, readGrid, sheetNames } from "@/lib/import/parse";
import { presetFor, presetForSheets } from "@/lib/import/presets";
import { canEditOpportunities, canImport } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

const MAX_BYTES = 15 * 1024 * 1024;

export async function uploadBridges(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canImport(user.role)) return { error: "Imports are run by admins and BD directors." };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { File: "Choose an .xlsx or .csv file" } };
  if (!/\.(xlsx|csv)$/i.test(file.name)) return { fieldErrors: { File: "Use .xlsx or .csv" } };
  if (file.size > MAX_BYTES) return { fieldErrors: { File: "Files up to 15 MB" } };
  const data = Buffer.from(await file.arrayBuffer());
  let id: string;
  try {
    const sheets = await sheetNames(file.name, data);
    // Prefer a known bridge tab, else the first sheet whose header row mentions a bridge.
    let sheet = presetForSheets(sheets, "bridges")?.sheet ?? null;
    if (!sheet) for (const s of sheets) { const g = await readGrid(file.name, data, s, await detectHeaderRow(file.name, data, s)); if (g.headers.some((h) => /bridge|structure/i.test(h))) { sheet = s; break; } }
    sheet = sheet ?? sheets[0];
    const headerRow = await detectHeaderRow(file.name, data, sheet);
    const grid = await readGrid(file.name, data, sheet, headerRow);
    const preset = presetFor(grid.headers, "bridges");
    const mapping = guessBridgeMapping(grid.headers);
    if (mapping.name == null || mapping.county == null) return { error: `Couldn't find the bridge name and county columns on "${sheet}". Headers found: ${grid.headers.join(", ")}` };
    const b = await prisma.importBatch.create({
      data: {
        target: "bridges", fileName: file.name, sheetNames: JSON.stringify(sheets), sheetName: sheet, headerRow,
        headers: JSON.stringify(grid.headers), rows: JSON.stringify(grid.rows), rowCount: grid.rows.length,
        mapping: JSON.stringify(mapping), defaults: JSON.stringify({ ...(preset?.defaults ?? { source: `${file.name} · ${sheet}` }), presetId: preset?.id }), createdById: user.id,
      },
    });
    id = b.id;
  } catch (e) {
    return { error: `Couldn't read that file: ${(e as Error).message}` };
  }
  redirect(`/bridges/import/${id}`);
}

export async function commitBridges(batchId: string) {
  const user = await requireUser();
  if (!canImport(user.role)) throw new Error("Imports are run by admins and BD directors.");
  const { b, preview, defaults } = await bridgePreview(batchId);
  if (b.status !== "DRAFT") redirect(`/bridges/import/${batchId}`);
  const creates = preview.rows.filter((r) => r.action === "create" && r.draft);
  for (let i = 0; i < creates.length; i += 500)
    await prisma.bridge.createMany({ data: creates.slice(i, i + 500).map((r) => ({ ...r.draft!, importKey: r.key!, source: defaults.source ?? b.fileName, importBatchId: b.id, lengthFt: r.draft!.lengthFt != null ? String(r.draft!.lengthFt) : null, widthFt: r.draft!.widthFt != null ? String(r.draft!.widthFt) : null })) });
  const updates = preview.rows.filter((r) => r.action === "update" && r.draft && r.matchId);
  for (let i = 0; i < updates.length; i += 100)
    await prisma.$transaction(updates.slice(i, i + 100).map((r) => {
      const { lengthFt, widthFt, ...d } = r.draft!;
      // Updates only fill what the file has; edits made in the app to blank-in-file fields stay.
      const data = Object.fromEntries(Object.entries({ ...d, lengthFt: lengthFt != null ? String(lengthFt) : null, widthFt: widthFt != null ? String(widthFt) : null }).filter(([, v]) => v != null && v !== ""));
      return prisma.bridge.update({ where: { id: r.matchId! }, data });
    }));
  await prisma.importBatch.update({ where: { id: b.id }, data: { status: "COMMITTED", committedAt: new Date(), created: creates.length, updated: updates.length, skipped: preview.counts.skip, errors: preview.counts.error } });
  revalidatePath("/bridges");
  redirect(`/bridges/import/${batchId}`);
}

/* ───── bundles ───── */

async function guard() {
  const u = await requireUser();
  if (!canEditOpportunities(u.role)) throw new Error("Your role can't build bundles.");
  return u;
}

export async function addToBundle(_: FormState, fd: FormData): Promise<FormState> {
  const u = await guard();
  const ids = all(fd, "bridgeIds");
  if (!ids.length) return { error: "Tick the bridges to add first." };
  let bundleId = str(fd, "bundleId");
  const newName = str(fd, "newBundle");
  if (!bundleId && !newName) return { fieldErrors: { Bundle: "Pick a bundle or name a new one" } };
  if (!bundleId) bundleId = (await prisma.bridgeBundle.create({ data: { name: newName!, createdById: u.id } })).id;
  for (const bridgeId of ids) await prisma.bundleBridge.upsert({ where: { bundleId_bridgeId: { bundleId, bridgeId } }, update: {}, create: { bundleId, bridgeId } });
  revalidatePath("/bridges");
  redirect(`/bridges/bundles/${bundleId}`);
}

export async function removeFromBundle(id: string) {
  await guard();
  const bb = await prisma.bundleBridge.delete({ where: { id } });
  revalidatePath(`/bridges/bundles/${bb.bundleId}`);
}

export async function saveBundle(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await guard();
  const name = str(fd, "name");
  if (!name) return { fieldErrors: { Name: "Required" } };
  const v = { unitCostPerSqFt: dec(fd, "unitCostPerSqFt"), designPct: dec(fd, "designPct"), cmPct: dec(fd, "cmPct"), contingencyPct: dec(fd, "contingencyPct") };
  const fe = badNumbers({ "Unit cost": v.unitCostPerSqFt, "Design %": v.designPct, "CM %": v.cmPct, "Contingency %": v.contingencyPct });
  if (Object.keys(fe).length) return { fieldErrors: fe };
  await prisma.bridgeBundle.update({ where: { id }, data: { ...v, name, status: str(fd, "status") ?? "concept", notes: str(fd, "notes"), state: str(fd, "state") ?? "PA" } });
  revalidatePath(`/bridges/bundles/${id}`);
  return undefined;
}

export async function saveBundleBridge(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await guard();
  const est = dec(fd, "estimate"), len = dec(fd, "lengthFt"), wid = dec(fd, "widthFt");
  const fe = badNumbers({ Estimate: est, Length: len, Width: wid });
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const bb = await prisma.bundleBridge.update({ where: { id }, data: { estimate: est } });
  await prisma.bridge.update({ where: { id: bb.bridgeId }, data: { lengthFt: len, widthFt: wid, bridgeType: str(fd, "bridgeType"), ownerName: str(fd, "ownerName"), ownerVerified: fd.get("ownerVerified") === "on" } });
  revalidatePath(`/bridges/bundles/${bb.bundleId}`);
  return undefined;
}

/** Start a P3 bundle opportunity for funding and pursuit (SPEC §4.11): PCS lead with QCG. */
export async function createBundleOpportunity(bundleId: string, total: number, _: FormState, fd: FormData): Promise<FormState> {
  const u = await guard();
  const orgId = str(fd, "orgId");
  if (!orgId) return { fieldErrors: { Owner: "Pick the owner (e.g. the county) the bundle would be pursued with" } };
  const b = await prisma.bridgeBundle.findUniqueOrThrow({ where: { id: bundleId } });
  const [pcs, qcg] = await Promise.all([prisma.company.findUnique({ where: { code: "PCS" } }), prisma.company.findUnique({ where: { code: "QCG" } })]);
  if (!pcs) return { error: "PCS company is missing; run the seed." };
  const o = await prisma.opportunity.create({
    data: {
      name: b.name, orgId, projectType: "bridge", deliveryMethod: "P3_BUNDLE", leadCompanyId: pcs.id,
      supportCompanies: qcg ? { connect: [{ id: qcg.id }] } : undefined, estimatedValue: total ? String(Math.round(total)) : null,
      ownerId: u.id, createdById: u.id, stageChanges: { create: { toStage: 1, changedById: u.id, note: "Created from bridge bundle" } },
    },
  });
  await prisma.bridgeBundle.update({ where: { id: bundleId }, data: { opportunityId: o.id } });
  revalidatePath(`/bridges/bundles/${bundleId}`);
  redirect(`/opportunities/${o.id}`);
}
