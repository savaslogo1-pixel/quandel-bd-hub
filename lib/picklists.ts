import { prisma } from "./db";

export async function picklist(list: string): Promise<string[]> {
  const rows = await prisma.picklistValue.findMany({
    where: { list, active: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map((r) => r.value);
}

export async function companies() {
  return prisma.company.findMany({ orderBy: { sortOrder: "asc" } });
}
