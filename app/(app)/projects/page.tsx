import { ExportLinks } from "@/components/ExportLinks";
import Link from "next/link";
import type { DeliveryMethod, Prisma, StateCode } from "@prisma/client";
import { CompanyTags, Empty, PageHeader } from "@/components/ui";
import { PICKLISTS, STATES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { money } from "@/lib/format";
import { parseMoney } from "@/lib/import/orgs";
import { canEditAccounts } from "@/lib/permissions";
import { DELIVERY_METHODS, deliveryLabel } from "@/lib/pipeline";
import { companies as loadCompanies, picklist } from "@/lib/picklists";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Projects and references" };

type SP = { q?: string; co?: string; type?: string; dm?: string; owner?: string; state?: string; min?: string; since?: string; status?: string; ref?: string };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const where: Prisma.ProjectWhereInput = {};
  const and: Prisma.ProjectWhereInput[] = [];
  if (sp.q) and.push({ OR: [{ name: { contains: sp.q } }, { results: { contains: sp.q } }, { org: { name: { contains: sp.q } } }] });
  if (sp.co) where.companies = { some: { code: sp.co } };
  if (sp.type) where.projectType = sp.type;
  if (sp.dm && DELIVERY_METHODS.includes(sp.dm as DeliveryMethod)) where.deliveryMethod = sp.dm as DeliveryMethod;
  if (sp.owner || (sp.state && STATES.includes(sp.state as StateCode))) where.org = { ...(sp.owner ? { orgType: sp.owner } : {}), ...(sp.state ? { state: sp.state as StateCode } : {}) };
  const min = sp.min ? parseMoney(sp.min) : null;
  if (typeof min === "number" && min > 0) where.value = { gte: String(min) };
  if (sp.since) where.completionYear = { gte: Number(sp.since) };
  if (sp.status) where.status = sp.status;
  if (sp.ref) where.referenceContactId = { not: null };
  if (and.length) where.AND = and;
  const [list, cos, types, orgTypes] = await Promise.all([
    prisma.project.findMany({ where, include: { org: { select: { id: true, name: true, state: true, orgType: true } }, companies: { orderBy: { sortOrder: "asc" } }, referenceContact: { select: { id: true, name: true } } }, orderBy: [{ completionYear: { sort: "desc", nulls: "first" } }, { name: "asc" }] }),
    loadCompanies(), picklist(PICKLISTS.projectType), picklist(PICKLISTS.orgType),
  ]);
  const filtered = Object.values(sp).some(Boolean);
  return (
    <>
      <PageHeader title="Projects and references" sub='Won and completed work across all five companies. Search like a qualification package: owner type, delivery method, size, year. For example, school district + GESA / EPC + $5M.' actions={<><ExportLinks table="projects" />{canEditAccounts(user.role) && <Link className="btn btn-primary" href="/projects/new">Add project</Link>}</>} />
      <form className="filters" method="get">
        <input type="search" name="q" placeholder="Search name, owner, results" defaultValue={sp.q} />
        <select name="co" defaultValue={sp.co ?? ""}><option value="">All companies</option>{cos.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select>
        <select name="owner" defaultValue={sp.owner ?? ""}><option value="">Any owner type</option>{orgTypes.map((t) => <option key={t}>{t}</option>)}</select>
        <select name="type" defaultValue={sp.type ?? ""}><option value="">Any project type</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
        <select name="dm" defaultValue={sp.dm ?? ""}><option value="">Any delivery method</option>{DELIVERY_METHODS.map((m) => <option key={m} value={m}>{deliveryLabel(m)}</option>)}</select>
        <select name="state" defaultValue={sp.state ?? ""}><option value="">All states</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select>
        <label className="muted text-xs">Value at least <input name="min" placeholder="e.g. 5M" defaultValue={sp.min} style={{ width: 80 }} /></label>
        <label className="muted text-xs">Completed since <input name="since" inputMode="numeric" placeholder="year" defaultValue={sp.since} style={{ width: 70 }} /></label>
        <label className="check"><input type="checkbox" name="ref" value="1" defaultChecked={!!sp.ref} /> Has a reference</label>
        <button className="btn btn-sm">Search</button>
        {filtered && <Link className="btn btn-sm" href="/projects">Clear</Link>}
      </form>
      {list.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Project</th><th>Owner</th><th>Companies</th><th>Type · delivery</th><th className="num">Value</th><th>Completed</th><th>Reference</th></tr></thead>
            <tbody>{list.map((p) => (
              <tr key={p.id}>
                <td><Link className="rowlink" href={`/projects/${p.id}`}>{p.name}</Link>{p.results && <div className="muted line-clamp-2 text-xs">{p.results}</div>}</td>
                <td><Link href={`/organizations/${p.org.id}`}>{p.org.name}</Link><div className="muted text-xs">{p.org.orgType} · {p.org.state}</div></td>
                <td><CompanyTags codes={p.companies} /></td>
                <td className="text-xs">{p.projectType ?? "—"}<div className="muted">{deliveryLabel(p.deliveryMethod)}</div></td>
                <td className="num">{money(p.value)}</td>
                <td>{p.status === "completed" ? p.completionYear ?? "yes" : <span className="chip">active</span>}</td>
                <td>{p.referenceContact ? <Link href={`/contacts/${p.referenceContact.id}`}>{p.referenceContact.name}</Link> : <span className="muted">—</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <Empty title={filtered ? "No projects match" : "No projects yet"}>{!filtered && "Projects come from opportunities that reach Contracted (stage 10), or add past work directly."}</Empty>}
    </>
  );
}
