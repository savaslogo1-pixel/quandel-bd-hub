import Link from "next/link";
import { ExportLinks } from "@/components/ExportLinks";
import { Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Municipal-advisor log" };

export default async function FinancingLog() {
  await requireUser();
  const acts = await prisma.activity.findMany({
    where: { financingDiscussed: true },
    include: { org: { select: { id: true, name: true } }, financialAdvisorContact: { select: { id: true, name: true, org: { select: { name: true } } } }, createdBy: { select: { name: true, email: true } } },
    orderBy: { occurredAt: "desc" },
    take: 300,
  });
  return (
    <>
      <PageHeader title="Municipal-advisor log" sub="Every activity where financing was discussed, with the owner's financial advisor it was referred to. Quandel staff don't advise owners on how to finance a project." actions={<ExportLinks table="financing" />} />
      {acts.length ? (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Date</th><th>Owner</th><th>Activity</th><th>Financial advisor</th><th>Logged by</th></tr></thead>
          <tbody>{acts.map((a) => (
            <tr key={a.id}>
              <td className="mono text-xs">{fmtDate(a.occurredAt)}</td>
              <td><Link href={`/organizations/${a.org.id}`}>{a.org.name}</Link></td>
              <td className="text-[13px]"><Link href={`/activities/${a.id}`}>{a.type}</Link>{a.notes && <div className="muted line-clamp-2 text-xs">{a.notes}</div>}</td>
              <td>{a.financialAdvisorContact ? <><Link href={`/contacts/${a.financialAdvisorContact.id}`}>{a.financialAdvisorContact.name}</Link><div className="muted text-xs">{a.financialAdvisorContact.org.name}</div></> : <span className="chip chip-bad">⛔ not linked</span>}</td>
              <td className="text-xs">{a.createdBy?.name ?? a.createdBy?.email}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <Empty title="No financing discussions logged" />}
    </>
  );
}
