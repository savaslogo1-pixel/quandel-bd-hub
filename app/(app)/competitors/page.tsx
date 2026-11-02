import Link from "next/link";
import { CompanyTags, Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canEditAccounts } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Competitors" };

export default async function CompetitorsPage() {
  const user = await requireUser();
  const list = await prisma.competitor.findMany({
    include: {
      competesWith: { orderBy: { sortOrder: "asc" } },
      _count: { select: { projects: true, winsAgainstUs: true } },
      projects: { select: { org: { select: { quandelTerritory: true } } } },
      opportunities: { select: { outcome: true } },
    },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader title="Competitors" sub="Who we compete with, their public work with owners, and our record against them. Projects link to organizations in the CRM so their activity shows on each account." actions={canEditAccounts(user.role) && <Link className="btn btn-primary" href="/competitors/new">Add competitor</Link>} />
      {list.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Competitor</th><th>Competes with</th><th className="num">Public projects</th><th className="num">In Quandel territory</th><th className="num">Pursuits against</th><th className="num">We won</th><th className="num">They won</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td><Link className="rowlink" href={`/competitors/${c.id}`}>{c.name}</Link><div className="muted text-xs">{c.kind}</div></td>
                  <td><CompanyTags codes={c.competesWith} /></td>
                  <td className="num">{c._count.projects || ""}</td>
                  <td className="num">{c.projects.filter((p) => p.org?.quandelTerritory).length || ""}</td>
                  <td className="num">{c.opportunities.length || ""}</td>
                  <td className="num">{c.opportunities.filter((o) => o.outcome === "WON").length || ""}</td>
                  <td className="num">{c._count.winsAgainstUs || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="No competitors yet" />}
    </>
  );
}
