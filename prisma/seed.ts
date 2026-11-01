// Seeds reference data only: the five companies + parent, picklists, and the funding program library.
// Source files live in /data so non-developers can edit them. Never seeds people or records.
import { PrismaClient } from "@prisma/client";
import companies from "../data/companies.json";
import picklists from "../data/picklists.json";
import programs from "../data/programs.json";

const prisma = new PrismaClient();

async function main() {
  for (const c of companies.companies) {
    await prisma.company.upsert({ where: { code: c.code }, update: c, create: c });
  }
  for (const [list, values] of Object.entries(picklists.lists)) {
    for (const [i, value] of (values as string[]).entries()) {
      await prisma.picklistValue.upsert({
        where: { list_value: { list, value } },
        update: {},
        create: { list, value, label: value, sortOrder: i },
      });
    }
  }
  // Programs: create missing ones only, so edits made in the app are never overwritten.
  for (const p of programs.programs) {
    const { last_verified, nextDeadline, ...rest } = p as typeof p & { last_verified: string | null; nextDeadline: string | null };
    await prisma.fundingProgram.upsert({
      where: { key: p.key },
      update: {},
      create: {
        ...(rest as Record<string, unknown> as { key: string; name: string; jurisdiction: string }),
        nextDeadline: nextDeadline ? new Date(nextDeadline + "T00:00:00Z") : null,
        lastVerifiedAt: last_verified ? new Date(last_verified + "T00:00:00Z") : null,
      },
    });
  }
  const counts = {
    companies: await prisma.company.count(),
    picklistValues: await prisma.picklistValue.count(),
    programs: await prisma.fundingProgram.count(),
  };
  console.log("Seeded", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
