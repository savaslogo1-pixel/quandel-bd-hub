import { CompanyTags, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Attestations" };

export default async function Attestations() {
  await requireUser();
  const year = new Date().getUTCFullYear();
  const people = await prisma.user.findMany({ where: { active: true }, include: { companies: true, attestations: { where: { year } } }, orderBy: { name: "asc" } });
  const signed = people.filter((p) => p.attestations.length).length;
  return (
    <>
      <PageHeader title={`${year} ethics attestations`} sub={`${signed} of ${people.length} people have signed. The attestation is required before anyone can log gifts or lobbying; people sign it under Training → My learning.`} />
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Person</th><th>Role</th><th>Companies</th><th>Signed</th></tr></thead>
        <tbody>{people.map((p) => (
          <tr key={p.id}><td>{p.name ?? p.email}</td><td className="text-xs">{ROLE_LABELS[p.role]}</td><td><CompanyTags codes={p.companies} /></td><td>{p.attestations[0] ? <span className="chip chip-ok">✓ {fmtDate(p.attestations[0].attestedAt)}</span> : <span className="chip chip-warn">⚠ not yet</span>}</td></tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
