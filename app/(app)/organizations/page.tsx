import Link from "next/link";
import type { Prisma, OrgStatus, StateCode, Tier } from "@prisma/client";
import { CompanyTags, Empty, PageHeader } from "@/components/ui";
import { ORG_STATUS_LABELS, PICKLISTS, STATES, TIERS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { parsePattern, patternText } from "@/lib/meetings";
import { canEditAccounts } from "@/lib/permissions";
import { companies as loadCompanies, picklist } from "@/lib/picklists";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Organizations" };

type SP = { q?: string; state?: string; type?: string; co?: string; tier?: string; status?: string; flag?: string; energyBefore?: string; mine?: string };

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const where: Prisma.OrganizationWhereInput = {};
  if (sp.q) where.OR = [{ name: { contains: sp.q } }, { county: { contains: sp.q } }, { region: { contains: sp.q } }];
  if (sp.state && STATES.includes(sp.state as StateCode)) where.state = sp.state as StateCode;
  if (sp.type) where.orgType = sp.type;
  if (sp.co) where.companies = { some: { code: sp.co } };
  if (sp.tier && TIERS.includes(sp.tier as Tier)) where.tier = sp.tier as Tier;
  if (sp.status && sp.status in ORG_STATUS_LABELS) where.status = sp.status as OrgStatus;
  if (sp.flag === "arc") where.arcCounty = true;
  if (sp.flag === "energy") where.energyCommunity = true;
  if (sp.flag === "oz") where.opportunityZoneTract = true;
  if (sp.flag === "dac") where.disadvantagedCommunity = true;
  if (sp.flag === "stress") where.fiscalStressStatus = { not: null };
  const before = Number(sp.energyBefore);
  if (sp.energyBefore && Number.isInteger(before))
    where.AND = [{ OR: [{ lastEnergyProjectYear: null }, { lastEnergyProjectYear: { lt: before } }] }];
  if (sp.mine) where.relationshipOwnerId = user.id;

  const [orgs, orgTypes, cos] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        companies: { orderBy: { sortOrder: "asc" } },
        relationshipOwner: true,
        _count: { select: { contacts: true } },
        activities: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
      },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
      take: 500,
    }),
    picklist(PICKLISTS.orgType),
    loadCompanies(),
  ]);
  const filtered = Object.values(sp).some(Boolean);

  return (
    <>
      <PageHeader
        title="Organizations"
        sub="Owners and partners. Each one carries company tags, a tier and its board's meeting pattern."
        actions={canEditAccounts(user.role) && <Link className="btn btn-primary" href="/organizations/new">Add organization</Link>}
      />
      <form className="filters" method="get">
        <input name="q" type="search" placeholder="Search name, county, region" defaultValue={sp.q} />
        <select name="state" defaultValue={sp.state ?? ""}><option value="">All states</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select>
        <select name="type" defaultValue={sp.type ?? ""}><option value="">All types</option>{orgTypes.map((t) => <option key={t}>{t}</option>)}</select>
        <select name="co" defaultValue={sp.co ?? ""}><option value="">All companies</option>{cos.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select>
        <select name="tier" defaultValue={sp.tier ?? ""}><option value="">All tiers</option>{TIERS.map((t) => <option key={t} value={t}>Tier {t}</option>)}</select>
        <select name="status" defaultValue={sp.status ?? ""}><option value="">All statuses</option>{Object.entries(ORG_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="flag" defaultValue={sp.flag ?? ""}>
          <option value="">Any flag</option><option value="arc">ARC county</option><option value="energy">Energy community</option>
          <option value="oz">Opportunity Zone</option><option value="dac">Disadvantaged community (NY)</option><option value="stress">Fiscal stress</option>
        </select>
        <label className="muted text-xs">Last energy project before <input name="energyBefore" inputMode="numeric" placeholder="year" defaultValue={sp.energyBefore} style={{ width: 80 }} /></label>
        <label className="check"><input type="checkbox" name="mine" value="1" defaultChecked={!!sp.mine} /> Mine</label>
        <button className="btn btn-sm" type="submit">Apply</button>
        {filtered && <Link className="btn btn-sm" href="/organizations">Clear</Link>}
      </form>

      {orgs.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Organization</th><th>Type</th><th>State · county</th><th>Tier</th><th>Status</th><th>Companies</th><th>Owner</th><th className="num">Contacts</th><th>Last activity</th><th>Board meets</th></tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td><Link className="rowlink" href={`/organizations/${o.id}`}>{o.name}</Link></td>
                  <td>{o.orgType}</td>
                  <td>{o.state}{o.county ? ` · ${o.county}` : ""}</td>
                  <td>{o.tier ? <span className={`chip ${o.tier === "A" ? "chip-gold" : ""}`}>{o.tier}</span> : null}</td>
                  <td>{ORG_STATUS_LABELS[o.status]}</td>
                  <td><CompanyTags codes={o.companies} /></td>
                  <td>{o.relationshipOwner ? o.relationshipOwner.name ?? o.relationshipOwner.email : <span className="muted">—</span>}</td>
                  <td className="num">{o._count.contacts}</td>
                  <td className="mono text-xs">{o.activities[0] ? fmtDate(o.activities[0].occurredAt) : "—"}</td>
                  <td className="text-xs">{patternText(parsePattern(o.meetingWeekday, o.meetingWeeksOfMonth)) || <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={filtered ? "No organizations match these filters" : "No organizations yet"} action={!filtered && canEditAccounts(user.role) ? <Link className="btn btn-primary" href="/organizations/new">Add organization</Link> : undefined}>
          {!filtered && "Add a school district, county, authority or other owner to start. Imports from the GESA eligible-owners workbook come in Phase 5."}
        </Empty>
      )}
      {orgs.length === 500 && <p className="muted mt-2 text-xs">Showing the first 500. Narrow the filters to see more.</p>}
    </>
  );
}
