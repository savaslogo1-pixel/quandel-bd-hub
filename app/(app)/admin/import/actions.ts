"use server";

import type { OrgStatus, StateCode, Tier } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STATES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { all, int, str, type FormState } from "@/lib/forms";
import { guessMapping, ORG_FIELDS, type Defaults, type Mapping, type OnDuplicate } from "@/lib/import/orgs";
import { detectHeaderRow, readGrid, sheetNames } from "@/lib/import/parse";
import { presetFor, presetForSheets, presetMapping } from "@/lib/import/presets";
import { commitBatch, parsed } from "@/lib/import/run";
import { canImport } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

const MAX_BYTES = 15 * 1024 * 1024;

async function guard() {
  const u = await requireUser();
  if (!canImport(u.role)) throw new Error("Imports are run by admins and BD directors.");
  return u;
}

async function parseInto(fileName: string, data: Buffer, sheets: string[], sheet: string | null, headerRow: number | null) {
  const preset = sheet ? null : presetForSheets(sheets);
  const chosen = sheet ?? preset?.sheet ?? sheets[0] ?? null;
  const hr = headerRow ?? (preset && preset.sheet === chosen ? preset.headerRow : await detectHeaderRow(fileName, data, chosen));
  const grid = await readGrid(fileName, data, chosen, hr);
  const match = presetFor(grid.headers);
  const mapping: Mapping = match ? presetMapping(match, grid.headers) : guessMapping(grid.headers);
  const defaults: Defaults & { presetId?: string } = match
    ? { ...match.defaults, presetId: match.id }
    : { onDuplicate: "fill", inferType: true, source: `${fileName}${chosen && chosen !== "CSV" ? ` · ${chosen}` : ""}` };
  return { sheetName: chosen, headerRow: hr, grid, mapping, defaults };
}

export async function uploadImport(_: FormState, fd: FormData): Promise<FormState> {
  const user = await guard();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { File: "Choose an .xlsx or .csv file" } };
  if (!/\.(xlsx|csv)$/i.test(file.name)) return { fieldErrors: { File: "Use .xlsx or .csv (save older .xls files as .xlsx first)" } };
  if (file.size > MAX_BYTES) return { fieldErrors: { File: "Files up to 15 MB" } };
  const data = Buffer.from(await file.arrayBuffer());
  let id: string;
  try {
    const sheets = await sheetNames(file.name, data);
    const p = await parseInto(file.name, data, sheets, null, null);
    const b = await prisma.importBatch.create({
      data: {
        target: "organizations", fileName: file.name, sheetNames: JSON.stringify(sheets), sheetName: p.sheetName, headerRow: p.headerRow,
        headers: JSON.stringify(p.grid.headers), rows: JSON.stringify(p.grid.rows), rowCount: p.grid.rows.length,
        mapping: JSON.stringify(p.mapping), defaults: JSON.stringify(p.defaults), fileData: data, createdById: user.id,
      },
    });
    id = b.id;
  } catch (e) {
    return { error: `Couldn't read that file: ${(e as Error).message}` };
  }
  revalidatePath("/admin/import");
  redirect(`/admin/import/${id}`);
}

export async function chooseSheet(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await guard();
  const b = await prisma.importBatch.findUnique({ where: { id } });
  if (!b || b.status !== "DRAFT" || !b.fileData) return { error: "This import can no longer be changed." };
  const sheet = str(fd, "sheet");
  const headerRow = int(fd, "headerRow");
  if (headerRow != null && (Number.isNaN(headerRow) || headerRow < 1 || headerRow > 50)) return { fieldErrors: { "Header row": "Use 1 to 50" } };
  const p = await parseInto(b.fileName, Buffer.from(b.fileData), parsed(b).sheets, sheet, headerRow);
  await prisma.importBatch.update({
    where: { id },
    data: { sheetName: p.sheetName, headerRow: p.headerRow, headers: JSON.stringify(p.grid.headers), rows: JSON.stringify(p.grid.rows), rowCount: p.grid.rows.length, mapping: JSON.stringify(p.mapping), defaults: JSON.stringify(p.defaults) },
  });
  revalidatePath(`/admin/import/${id}`);
  return undefined;
}

export async function saveMapping(id: string, _: FormState, fd: FormData): Promise<FormState> {
  await guard();
  const b = await prisma.importBatch.findUnique({ where: { id } });
  if (!b || b.status !== "DRAFT") return { error: "This import can no longer be changed." };
  const width = parsed(b).headers.length;
  const mapping = {} as Mapping;
  for (const f of ORG_FIELDS) {
    const v = str(fd, `map_${f.key}`);
    if (v != null && Number(v) >= 0 && Number(v) < width) mapping[f.key] = Number(v);
  }
  mapping.notes = all(fd, "notes").map(Number).filter((n) => n >= 0 && n < width);
  if (mapping.name == null) return { fieldErrors: { Name: "Pick the column that holds the organization name" } };
  const state = str(fd, "state") as StateCode | null;
  if (state && !STATES.includes(state)) return { fieldErrors: { State: "Invalid" } };
  const prev = parsed(b).defaults;
  const defaults: Defaults & { presetId?: string } = {
    state: state ?? "", orgType: str(fd, "orgType") ?? "", tier: (str(fd, "tier") ?? "") as Tier | "", status: (str(fd, "status") ?? "") as OrgStatus | "",
    companyCodes: all(fd, "companyCodes"), companyCodesWhenTier: all(fd, "companyCodesWhenTier"),
    source: str(fd, "source") ?? "", onDuplicate: (str(fd, "onDuplicate") ?? "fill") as OnDuplicate, inferType: fd.get("inferType") === "on",
    resolutions: prev.resolutions, presetId: prev.presetId,
  };
  await prisma.importBatch.update({ where: { id }, data: { mapping: JSON.stringify(mapping), defaults: JSON.stringify(defaults) } });
  revalidatePath(`/admin/import/${id}`);
  return undefined;
}

/** A person's call on a "possible duplicate" row: an existing organization id, or "new". */
export async function resolveRow(id: string, line: number, value: string) {
  await guard();
  const b = await prisma.importBatch.findUnique({ where: { id } });
  if (!b || b.status !== "DRAFT") return;
  const d = parsed(b).defaults;
  d.resolutions = { ...(d.resolutions ?? {}), [String(line)]: value };
  await prisma.importBatch.update({ where: { id }, data: { defaults: JSON.stringify(d) } });
  revalidatePath(`/admin/import/${id}`);
}

export async function commitImport(id: string) {
  const user = await guard();
  const b = await prisma.importBatch.findUnique({ where: { id } });
  if (!b || b.status !== "DRAFT") redirect(`/admin/import/${id}`);
  await commitBatch(b, user.id);
  revalidatePath("/organizations");
  revalidatePath("/admin/import");
  redirect(`/admin/import/${id}`);
}

/** Undo removes organizations this import created that nobody has added work to. Updates stay. */
export async function undoImport(id: string) {
  await guard();
  const b = await prisma.importBatch.findUnique({ where: { id } });
  if (!b || b.status !== "COMMITTED") return;
  const res = await prisma.organization.deleteMany({
    where: { importBatchId: id, contacts: { none: {} }, activities: { none: {} }, opportunities: { none: {} }, childOrgs: { none: {} } },
  });
  const kept = await prisma.organization.count({ where: { importBatchId: id } });
  await prisma.importBatch.update({ where: { id }, data: { status: "UNDONE", undoneAt: new Date(), created: kept } });
  revalidatePath("/organizations");
  revalidatePath(`/admin/import/${id}`);
  redirect(`/admin/import/${id}?undone=${res.count}&kept=${kept}`);
}

export async function discardImport(id: string) {
  await guard();
  await prisma.importBatch.deleteMany({ where: { id, status: "DRAFT" } });
  revalidatePath("/admin/import");
  redirect("/admin/import");
}
