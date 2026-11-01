// Seeds reference data only (SPEC §12 Phase 1): the five companies + parent, and picklists.
// Source files live in /data so non-developers can edit them. Never seeds people or records.
import { PrismaClient } from "@prisma/client";
import companies from "../data/companies.json";
import picklists from "../data/picklists.json";

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
  const counts = {
    companies: await prisma.company.count(),
    picklistValues: await prisma.picklistValue.count(),
  };
  console.log("Seeded", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
