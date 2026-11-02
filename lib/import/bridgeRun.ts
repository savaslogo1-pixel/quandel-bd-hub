// Server-side helper (not a server action): preview a bridge import batch.
import { prisma } from "../db";
import { buildBridgePreview, type BridgeField } from "./bridges";

export async function bridgePreview(batchId: string) {
  const b = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  const existing = await prisma.bridge.findMany({ select: { id: true, importKey: true } });
  const defaults = JSON.parse(b.defaults ?? "{}") as { condition?: string; source?: string; presetId?: string };
  const preview = buildBridgePreview({ rows: JSON.parse(b.rows), headerRow: b.headerRow, mapping: JSON.parse(b.mapping ?? "{}") as Partial<Record<BridgeField, number>>, defaults, existing });
  return { b, preview, defaults };
}

