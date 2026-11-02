import { prisma } from "./db";
import { looseName } from "./import/orgs";

const county = (c: string | null | undefined) => (c ?? "").toLowerCase().replace(/\s+county$/, "").trim();

/**
 * Link competitor projects to CRM organizations by similar name ("Allentown SD" =
 * "Allentown City School District") in the same state and county. Returns how many were linked.
 */
export async function linkCompetitorProjects(): Promise<{ linked: number; unlinked: number }> {
  const rows = await prisma.competitorProject.findMany({ where: { orgId: null } });
  if (!rows.length) return { linked: 0, unlinked: 0 };
  const orgs = await prisma.organization.findMany({ where: { state: { in: [...new Set(rows.map((r) => r.state))] as never[] } }, select: { id: true, name: true, state: true, county: true } });
  const idx = new Map<string, { id: string; county: string | null }[]>();
  for (const o of orgs) {
    const k = `${looseName(o.name)}|${o.state}`;
    idx.set(k, [...(idx.get(k) ?? []), o]);
  }
  let linked = 0;
  for (const r of rows) {
    const cands = idx.get(`${looseName(r.ownerName)}|${r.state}`) ?? [];
    const hit = cands.find((o) => county(o.county) === county(r.county)) ?? (cands.length === 1 && !r.county ? cands[0] : undefined);
    if (hit) {
      await prisma.competitorProject.update({ where: { id: r.id }, data: { orgId: hit.id } });
      linked++;
    }
  }
  return { linked, unlinked: rows.length - linked };
}
