// Load a bid-tracker JSON file into the bid feed. Safe to run again: the same external
// key updates the row and does not reset a decision (approved, dismissed, on hold).
//
//   npm run bid-feed:import
//   npm run bid-feed:import -- path/to/tracker.json
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadDotEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key]) continue;
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

async function main() {
  loadDotEnv();
  const file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(process.cwd(), "data", "bid_feed_tracker.json");
  const data = JSON.parse(readFileSync(file, "utf8")) as unknown;
  const { trackerToBatch, KIND_LABELS } = await import("../lib/bidFeed/parse");
  const { upsertBidFeedItems } = await import("../lib/bidFeed/store");
  const { prisma } = await import("../lib/db");

  const parsed = trackerToBatch(data);
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exit(1);
  }
  for (const e of parsed.errors) console.error(`item ${e.index} (${e.externalKey ?? "no key"}): ${e.message}`);
  const saved = await upsertBidFeedItems(parsed.items);
  for (const e of saved.errors) console.error(`${e.externalKey}: ${e.message}`);

  const rows = await prisma.bidFeedItem.groupBy({ by: ["kind", "status"], _count: true });
  const byKind = new Map<string, number>();
  for (const row of rows) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + row._count);
  console.log(`Created ${saved.created}, updated ${saved.updated}, ${parsed.errors.length + saved.errors.length} error(s).`);
  for (const [kind, n] of byKind) console.log(`  ${KIND_LABELS[kind as keyof typeof KIND_LABELS] ?? kind}: ${n}`);
  await prisma.$disconnect();
  if (parsed.errors.length || saved.errors.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
