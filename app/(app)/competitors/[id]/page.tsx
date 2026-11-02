import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { CompanyTags } from "@/components/ui";
import { COMPETITOR_CATEGORIES } from "@/lib/competitorLabels";
import { STATES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { money } from "@/lib/format";
import { canEditAccounts } from "@/lib/permissions";
import { OUTCOME_LABELS, stageName } from "@/lib/pipeline";
import { requireUser } from "@/lib/session";
import { addCompetitorProject, deleteCompetitorProject, linkProjects, saveCompetitor, setProjectOrg } from "../actions";
import { CompetitorForm } from "../CompetitorForm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.competitor.findUnique({ where: { id }, select: { name: true } });
  return { title: c?.name ?? "Competitor" };
}

export default async function CompetitorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cat?: string; territory?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const c = await prisma.competitor.findUnique({
    where: { id },
    include: {
      competesWith: { orderBy: { sortOrder: "asc" } },
      projects: { include: { org: { select: { id: true, name: true, county: true, quandelTerritory: true, tier: true } } }, orderBy: [{ category: "asc" }, { year: { sort: "desc", nulls: "last" } }, { ownerName: "asc" }] },
      opportunities: { include: { org: { select: { name: true } } }, orderBy: { updatedAt: "desc" } },
      winsAgainstUs: { include: { org: { select: { name: true } } } },
    },
  });
  if (!c) notFound();
  const edit = canEditAccounts(user.role);
  const shown = c.projects.filter((p) => (!sp.cat || p.category === sp.cat) && (!sp.territory || p.org?.quandelTerritory));
  const unlinked = c.projects.filter((p) => !p.orgId).length;
  const inTerritory = c.projects.filter((p) => p.org?.quandelTerritory);
  const owners = new Set(c.projects.map((p) => p.ownerName)).size;
  const total = c.projects.reduce((a, p) => a + (p.value != null ? Number(p.value) : 0), 0);
  const orgsForLink = unlinked && edit ? await prisma.organization.findMany({ select: { id: true, name: true, county: true, state: true }, orderBy: { name: "asc" } }) : [];
  const won = c.opportunities.filter((o) => o.outcome === "WON").length;
  return (
    <>
      <div className="mb-4">
        <div className="eyebrow"><Link href="/competitors">Competitors</Link> · {c.kind}</div>
        <h1 className="text-[28px] font-semibold">{c.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2"><span className="muted text-sm">Competes with</span><CompanyTags codes={c.competesWith} />{c.website && <a href={c.website} target="_blank" rel="noopener noreferrer">Website</a>}</div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[[c.projects.length, "Public projects"], [owners, "Owners"], [inTerritory.length, "In Quandel territory"], [`${won}–${c.winsAgainstUs.length}`, "Our record (won–lost)"], [total ? money(total) : "—", "Values published"]].map(([v, l]) => (
          <div key={String(l)} className="panel"><b className="block font-[family-name:var(--font-display)] text-[26px] font-semibold leading-tight">{v}</b><span className="muted text-[12.5px]">{l}</span></div>
        ))}
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <section className="panel"><h2 className="mb-1 text-lg">How they win</h2><p className="whitespace-pre-wrap text-[13.5px]">{c.howTheyWin ?? "—"}</p>{c.pricingNotes && <><h3 className="mb-1 mt-3 text-base">Pricing</h3><p className="whitespace-pre-wrap text-[13.5px]">{c.pricingNotes}</p></>}</section>
        <section className="panel" style={{ borderColor: "var(--brand)" }}><h2 className="mb-1 text-lg">Our response</h2><p className="whitespace-pre-wrap text-[13.5px]">{c.ourResponse ?? "—"}</p></section>
        <section className="panel lg:col-span-2">
          <h2 className="mb-1 text-lg">Profile</h2>
          <div className="facts mb-2"><div><div className="k">Headquarters</div><div className="v">{c.headquarters ?? "—"}</div></div><div><div className="k">Ownership</div><div className="v">{c.ownership ?? "—"}</div></div><div><div className="k">Other names</div><div className="v whitespace-pre-wrap">{c.aliases ?? "—"}</div></div></div>
          {c.profile && <p className="whitespace-pre-wrap text-[13.5px]">{c.profile}</p>}
          {c.source && <p className="muted mt-2 text-xs">Source: {c.source}. Confirm with board minutes before quoting.</p>}
        </section>
      </div>

      <section className="mb-5">
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          <h2 className="flex-1 text-lg">Their projects</h2>
          {edit && unlinked > 0 && <form action={linkProjects.bind(null, c.id)}><button className="btn btn-sm">Link {unlinked} unlinked to CRM organizations</button></form>}
        </div>
        <nav className="filters">
          <Link href={`/competitors/${c.id}`} className={`btn btn-sm ${!sp.cat && !sp.territory ? "btn-primary" : ""}`}>All · {c.projects.length}</Link>
          <Link href={`/competitors/${c.id}?territory=1`} className={`btn btn-sm ${sp.territory ? "btn-primary" : ""}`}>In Quandel territory · {inTerritory.length}</Link>
          {Object.entries(COMPETITOR_CATEGORIES).map(([k, l]) => { const n = c.projects.filter((p) => p.category === k).length; return n ? <Link key={k} href={`/competitors/${c.id}?cat=${k}`} className={`btn btn-sm ${sp.cat === k ? "btn-primary" : ""}`}>{l} · {n}</Link> : null; })}
        </nav>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Owner</th><th>County</th><th>Category</th><th>What</th><th>When</th><th className="num">Value</th><th>Source</th><th /></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.org ? <Link className="rowlink" href={`/organizations/${p.org.id}`}>{p.org.name}</Link> : <b>{p.ownerName}</b>}
                    {p.org?.quandelTerritory && <span className="chip chip-brand ml-1">territory</span>}
                    {p.org?.tier && <span className="chip ml-1">Tier {p.org.tier}</span>}
                    {!p.org && <div className="muted text-xs">not in the CRM</div>}
                    {!p.org && edit && (
                      <details><summary className="cursor-pointer text-xs" style={{ color: "var(--brand)" }}>Link</summary>
                        <ActionForm action={setProjectOrg.bind(null, p.id)} className="flex gap-2" submitLabel="Link">
                          <select name="orgId" className="max-w-[260px]" defaultValue="">{[<option key="" value="">Choose…</option>, ...orgsForLink.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.county} {o.state}</option>)]}</select>
                        </ActionForm>
                      </details>
                    )}
                  </td>
                  <td>{p.county}</td>
                  <td className="text-xs">{COMPETITOR_CATEGORIES[p.category] ?? p.category}</td>
                  <td className="text-[13px]">{p.description}</td>
                  <td className="text-xs">{p.when}</td>
                  <td className="num">{p.value != null ? money(p.value) : ""}</td>
                  <td className="text-xs">{p.sourceUrl ? <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">{p.sourceTitle ?? "Source"}</a> : p.sourceTitle}</td>
                  <td>{edit && <form action={deleteCompetitorProject.bind(null, p.id)}><button className="btn btn-sm btn-danger" aria-label="Remove project">×</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-1 text-lg">Our pursuits against them</h2>
        {c.opportunities.length ? (
          <ul className="rows panel">{c.opportunities.map((o) => <li key={o.id}><Link href={`/opportunities/${o.id}`} className="font-semibold">{o.name}</Link><span className="muted text-xs">{o.org.name} · {o.outcome ? OUTCOME_LABELS[o.outcome] : stageName(o.stage)}{o.lostToId === c.id && " · they won"}</span></li>)}</ul>
        ) : <p className="muted">None yet. Pick competitors on an opportunity's Edit page; when we lose, record who won on the Result panel.</p>}
      </section>

      {edit && (
        <>
          <details className="panel mb-4"><summary className="cursor-pointer font-semibold">Add a project</summary><div className="mt-2">
            <ActionForm action={addCompetitorProject.bind(null, c.id)} className="form cols-3" submitLabel="Add project">
              <label className="field"><span>Owner (as published)</span><input name="ownerName" /></label>
              <label className="field"><span>County</span><input name="county" /></label>
              <label className="field"><span>State</span><select name="state" defaultValue="PA">{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label className="field"><span>Category</span><select name="category">{Object.entries(COMPETITOR_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="field"><span>When</span><input name="when" placeholder="e.g., Mar 2026" /></label>
              <label className="field"><span>Year</span><input name="year" inputMode="numeric" /></label>
              <label className="field full"><span>What</span><input name="description" /></label>
              <label className="field"><span>Value ($)</span><input name="value" inputMode="decimal" /></label>
              <label className="field"><span>Source title</span><input name="sourceTitle" /></label>
              <label className="field"><span>Source link</span><input name="sourceUrl" /></label>
            </ActionForm>
          </div></details>
          <details className="panel"><summary className="cursor-pointer font-semibold">Edit profile</summary><div className="mt-2"><CompetitorForm action={saveCompetitor.bind(null, c.id)} c={c} /></div></details>
        </>
      )}
    </>
  );
}
