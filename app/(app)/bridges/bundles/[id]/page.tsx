import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Confirm, Empty, VerifiedBadge } from "@/components/ui";
import { bundleEstimate } from "@/lib/bridges";
import { STATES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { money } from "@/lib/format";
import { canEditOpportunities } from "@/lib/permissions";
import { verification } from "@/lib/programs";
import { requireUser } from "@/lib/session";
import { createBundleOpportunity, removeFromBundle, saveBundle, saveBundleBridge } from "../../actions";

const n = (v: unknown) => (v == null ? null : Number(v));

export default async function BundlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const b = await prisma.bridgeBundle.findUnique({ where: { id }, include: { bridges: { include: { bridge: true }, orderBy: { createdAt: "asc" } }, opportunity: { select: { id: true, name: true } } } });
  if (!b) notFound();
  const edit = canEditOpportunities(user.role);
  const est = bundleEstimate(
    b.bridges.map((x) => ({ id: x.id, name: x.bridge.name, county: x.bridge.county, bridgeType: x.bridge.bridgeType, estimate: n(x.estimate), lengthFt: n(x.bridge.lengthFt), widthFt: n(x.bridge.widthFt) })),
    { unitCostPerSqFt: n(b.unitCostPerSqFt), designPct: n(b.designPct), cmPct: n(b.cmPct), contingencyPct: n(b.contingencyPct) },
  );
  const legal = await prisma.stateRule.findUnique({ where: { key: `${b.state}.p3_legal_path` } });
  const counties = [...new Set(b.bridges.map((x) => x.bridge.county))];
  const owners = edit ? await prisma.organization.findMany({ where: { state: b.state as never, OR: [{ orgType: "county", county: { in: counties } }, { county: { in: counties } }] }, select: { id: true, name: true, orgType: true }, orderBy: [{ orgType: "asc" }, { name: "asc" }], take: 300 }) : [];
  const line = new Map(est.lines.map((l) => [l.id, l]));
  return (
    <>
      <div className="mb-4">
        <div className="eyebrow"><Link href="/bridges">Bridges</Link> · bundle · {b.status}</div>
        <h1 className="text-[28px] font-semibold">{b.name}</h1>
        <p className="muted">{b.bridges.length} bridges in {counties.join(", ") || "—"}</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Construction", money(est.construction)], ["Design", money(est.design)], ["CM", money(est.cm)], ["Contingency", money(est.contingency)], ["Bundle estimate", money(est.total)]].map(([k, v], i) => (
          <div key={k} className="panel" style={i === 4 ? { borderColor: "var(--brand)" } : undefined}><b className="block font-[family-name:var(--font-display)] text-[24px] font-semibold leading-tight">{v}</b><span className="muted text-[12.5px]">{k}</span></div>
        ))}
      </div>
      {est.missing > 0 && <p className="banner banner-warn">{est.missing} of {b.bridges.length} bridges have no estimate yet. Enter a bridge's own estimate, or its length and width plus the bundle's cost per square foot. Until then the total covers only the others.</p>}

      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section>
          <h2 className="mb-1 text-lg">By type and county</h2>
          {est.groups.length ? (
            <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Type</th><th>County</th><th className="num">Bridges</th><th className="num">Construction</th><th className="num">Missing</th></tr></thead>
              <tbody>{est.groups.map((g) => <tr key={g.type + g.county}><td>{g.type}</td><td>{g.county}</td><td className="num">{g.count}</td><td className="num">{money(g.cost)}</td><td className="num">{g.missing || ""}</td></tr>)}</tbody></table></div>
          ) : <Empty title="No bridges in this bundle" />}
        </section>
        <div className="flex flex-col gap-4">
          <section className="panel">
            <h2 className="mb-1 text-lg">Legal path ({b.state})</h2>
            {legal ? <><p className="text-[13.5px]">{legal.text}</p><div className="mt-1"><VerifiedBadge at={legal.lastVerifiedAt} state={verification(legal.lastVerifiedAt)} /></div></> : <p><Confirm /> No P3 legal-path rule for {b.state} yet; research it and add it on State rules.</p>}
          </section>
          <section className="panel">
            <h2 className="mb-1 text-lg">Funding and pursuit</h2>
            {b.opportunity ? (
              <p>Pursued as <Link href={`/opportunities/${b.opportunity.id}`}>{b.opportunity.name}</Link>. Build the funding (state bridge programs, federal aid, county bonds) on its <Link href={`/opportunities/${b.opportunity.id}?tab=stack`}>capital stack</Link>.</p>
            ) : edit ? (
              <ActionForm action={createBundleOpportunity.bind(null, id, est.total)} className="form" submitLabel="Start a P3 bundle opportunity">
                <label className="field full"><span>Owner to pursue it with</span><select name="orgId" defaultValue=""><option value="">Choose…</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.orgType})</option>)}</select></label>
                <p className="muted full text-xs">Creates an opportunity (P3 bundle, PCS lead with QCG, estimated value {money(est.total)}) so the bundle gets a capital stack, approvals and the pipeline.</p>
              </ActionForm>
            ) : <p className="muted">No opportunity yet.</p>}
          </section>
        </div>
      </div>

      <section className="mb-5">
        <h2 className="mb-1 text-lg">Bridges</h2>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Bridge</th><th>County</th><th className="num">Built</th><th className="num">Vehicles/day</th><th>Owner</th><th>Type</th><th className="num">Deck (ft)</th><th className="num">Estimate</th><th>Basis</th><th /></tr></thead>
            <tbody>
              {b.bridges.map((x) => {
                const l = line.get(x.id)!;
                return (
                  <tr key={x.id}>
                    <td><b>{x.bridge.name}</b>
                      {edit && <details className="mt-1"><summary className="cursor-pointer text-xs" style={{ color: "var(--brand)" }}>Edit</summary><div className="mt-2 min-w-[300px]"><ActionForm action={saveBundleBridge.bind(null, x.id)} className="form" submitLabel="Save">
                        <label className="field"><span>Estimate ($)</span><input name="estimate" inputMode="decimal" defaultValue={x.estimate != null ? String(x.estimate) : ""} /></label>
                        <label className="field"><span>Type</span><input name="bridgeType" defaultValue={x.bridge.bridgeType ?? ""} placeholder="e.g., box beam" /></label>
                        <label className="field"><span>Length (ft)</span><input name="lengthFt" inputMode="decimal" defaultValue={x.bridge.lengthFt != null ? String(x.bridge.lengthFt) : ""} /></label>
                        <label className="field"><span>Width (ft)</span><input name="widthFt" inputMode="decimal" defaultValue={x.bridge.widthFt != null ? String(x.bridge.widthFt) : ""} /></label>
                        <label className="field full"><span>Owner</span><input name="ownerName" defaultValue={x.bridge.ownerName ?? ""} /></label>
                        <label className="check full"><input type="checkbox" name="ownerVerified" defaultChecked={x.bridge.ownerVerified} /> Owner verified</label>
                      </ActionForm></div></details>}
                    </td>
                    <td>{x.bridge.county}</td>
                    <td className="num">{x.bridge.yearBuilt ?? ""}</td>
                    <td className="num">{x.bridge.adt?.toLocaleString() ?? ""}</td>
                    <td className="text-xs">{x.bridge.ownerName ?? "—"}{x.bridge.ownerVerified && " ✓"}</td>
                    <td className="text-xs">{x.bridge.bridgeType ?? <span className="muted">—</span>}</td>
                    <td className="num">{x.bridge.lengthFt != null && x.bridge.widthFt != null ? `${n(x.bridge.lengthFt)} × ${n(x.bridge.widthFt)}` : ""}</td>
                    <td className="num">{l.cost != null ? money(l.cost) : <span className="muted">—</span>}</td>
                    <td className="text-xs">{l.basis === "estimate" ? "own estimate" : l.basis === "area" ? "area × unit cost" : <span style={{ color: "var(--warn)" }}>missing</span>}</td>
                    <td>{edit && <form action={removeFromBundle.bind(null, x.id)}><button className="btn btn-sm btn-danger">Remove</button></form>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {edit && (
        <section className="panel">
          <h2 className="mb-2 text-lg">Bundle and estimate inputs</h2>
          <ActionForm action={saveBundle.bind(null, id)} className="form cols-3" submitLabel="Save bundle">
            <label className="field"><span>Name</span><input name="name" defaultValue={b.name} /></label>
            <label className="field"><span>Status</span><select name="status" defaultValue={b.status}>{["concept", "owner resolution", "procurement", "awarded", "dropped"].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="field"><span>State</span><select name="state" defaultValue={b.state}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="field"><span>Construction cost per sq ft of deck ($)</span><input name="unitCostPerSqFt" inputMode="decimal" defaultValue={b.unitCostPerSqFt != null ? String(b.unitCostPerSqFt) : ""} placeholder="from estimating" /></label>
            <label className="field"><span>Design (% of construction)</span><input name="designPct" inputMode="decimal" defaultValue={b.designPct != null ? String(b.designPct) : ""} /></label>
            <label className="field"><span>CM (% of construction)</span><input name="cmPct" inputMode="decimal" defaultValue={b.cmPct != null ? String(b.cmPct) : ""} /></label>
            <label className="field"><span>Contingency (% of construction)</span><input name="contingencyPct" inputMode="decimal" defaultValue={b.contingencyPct != null ? String(b.contingencyPct) : ""} /></label>
            <label className="field full"><span>Notes</span><textarea name="notes" defaultValue={b.notes ?? ""} /></label>
          </ActionForm>
          <p className="muted mt-2 text-xs">The app holds no default unit costs or percentages; they come from Quandel estimating for each bundle.</p>
        </section>
      )}
    </>
  );
}
