import { ExportLinks } from "@/components/ExportLinks";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canEditOpportunities, canImport } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { addToBundle } from "./actions";

export const metadata = { title: "Bridges" };

type SP = { q?: string; county?: string; owner?: string; route?: string; age?: string; adt?: string; free?: string };

export default async function BridgesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const year = new Date().getUTCFullYear();
  const where: Prisma.BridgeWhereInput = {};
  if (sp.q) where.OR = [{ name: { contains: sp.q } }, { municipality: { contains: sp.q } }, { notes: { contains: sp.q } }];
  if (sp.county) where.county = sp.county;
  if (sp.owner === "none") where.ownerName = null;
  else if (sp.owner) where.ownerName = sp.owner;
  if (sp.route) where.routeType = sp.route;
  if (Number(sp.age) > 0) where.yearBuilt = { lte: year - Number(sp.age) };
  if (Number(sp.adt) > 0) where.adt = { gte: Number(sp.adt) };
  if (sp.free) where.bundles = { none: {} };
  const [bridges, total, counties, owners, routes, bundles] = await Promise.all([
    prisma.bridge.findMany({ where, include: { bundles: { include: { bundle: { select: { id: true, name: true } } } } }, orderBy: [{ county: "asc" }, { yearBuilt: { sort: "asc", nulls: "last" } }], take: 400 }),
    prisma.bridge.count({ where }),
    prisma.bridge.groupBy({ by: ["county"], _count: true, orderBy: { county: "asc" } }),
    prisma.bridge.groupBy({ by: ["ownerName"], _count: true, orderBy: { _count: { ownerName: "desc" } } }),
    prisma.bridge.groupBy({ by: ["routeType"], _count: true }),
    prisma.bridgeBundle.findMany({ include: { _count: { select: { bridges: true } } }, orderBy: { updatedAt: "desc" } }),
  ]);
  const canBundle = canEditOpportunities(user.role);
  const filtered = Object.values(sp).some(Boolean);
  return (
    <>
      <PageHeader
        title="Bridges"
        sub="Bridge inventory for the P3 and bundling program (PCS with QCG). Filter, tick bridges and add them to a bundle; the bundle groups them by type and county and builds the estimate."
        actions={<><ExportLinks table="bridges" />{canImport(user.role) && <Link className="btn" href="/bridges/import">Import a bridge list</Link>}</>}
      />
      {bundles.length > 0 && (
        <section className="mb-4 flex flex-wrap gap-2">
          {bundles.map((b) => <Link key={b.id} href={`/bridges/bundles/${b.id}`} className="chip chip-brand">{b.name} · {b._count.bridges} bridges · {b.status}</Link>)}
        </section>
      )}
      <form className="filters" method="get">
        <input type="search" name="q" placeholder="Search bridge, municipality, notes" defaultValue={sp.q} />
        <select name="county" defaultValue={sp.county ?? ""}><option value="">All counties</option>{counties.map((c) => <option key={c.county} value={c.county}>{c.county} ({c._count})</option>)}</select>
        <select name="owner" defaultValue={sp.owner ?? ""}><option value="">Any owner</option>{owners.map((o) => <option key={o.ownerName ?? "none"} value={o.ownerName ?? "none"}>{o.ownerName ?? "Owner unknown"} ({o._count})</option>)}</select>
        <select name="route" defaultValue={sp.route ?? ""}><option value="">Any route type</option>{routes.filter((r) => r.routeType).map((r) => <option key={r.routeType} value={r.routeType!}>{r.routeType}</option>)}</select>
        <label className="muted text-xs">Older than <input name="age" inputMode="numeric" placeholder="yrs" defaultValue={sp.age} style={{ width: 60 }} /></label>
        <label className="muted text-xs">Traffic at least <input name="adt" inputMode="numeric" placeholder="veh/day" defaultValue={sp.adt} style={{ width: 80 }} /></label>
        <label className="check"><input type="checkbox" name="free" value="1" defaultChecked={!!sp.free} /> Not in a bundle</label>
        <button className="btn btn-sm">Apply</button>
        {filtered && <Link className="btn btn-sm" href="/bridges">Clear</Link>}
      </form>
      {bridges.length ? (
        <ActionForm action={addToBundle} className="flex flex-col gap-3" submitLabel="Add ticked bridges to bundle" extraButtons={canBundle ? (
          <span className="flex flex-wrap items-center gap-2">
            <select name="bundleId" defaultValue=""><option value="">New bundle named →</option>{bundles.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <input name="newBundle" placeholder="e.g., Schuylkill local bridges" />
          </span>
        ) : null}>
          <p className="muted text-sm">{total} bridges{total > bridges.length && `; showing the first ${bridges.length} (narrow the filters)`}. Condition, year and traffic come from the source list; verify owners before outreach.</p>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>{canBundle && <th />}<th>Bridge</th><th>County</th><th className="num">Built</th><th className="num">Age</th><th className="num">Vehicles/day</th><th>Route</th><th>Owner</th><th>Condition</th><th>Bundles</th></tr></thead>
              <tbody>
                {bridges.map((b) => (
                  <tr key={b.id}>
                    {canBundle && <td><input type="checkbox" name="bridgeIds" value={b.id} aria-label={`Select ${b.name}`} /></td>}
                    <td><b>{b.name}</b>{b.municipality && <div className="muted text-xs">{b.municipality}</div>}{b.notes && <div className="muted text-xs">{b.notes}</div>}</td>
                    <td>{b.county}</td>
                    <td className="num">{b.yearBuilt ?? ""}</td>
                    <td className="num">{b.yearBuilt ? year - b.yearBuilt : ""}</td>
                    <td className="num">{b.adt?.toLocaleString() ?? ""}</td>
                    <td className="text-xs">{b.routeType ?? ""}</td>
                    <td className="text-xs">{b.ownerName ?? <span className="muted">unknown</span>}{b.ownerVerified && <span className="chip chip-ok ml-1">verified</span>}</td>
                    <td>{b.condition && <span className={`chip ${b.condition === "Poor" ? "chip-bad" : ""}`}>{b.condition}</span>}</td>
                    <td className="text-xs">{b.bundles.map((x) => <Link key={x.id} href={`/bridges/bundles/${x.bundle.id}`}>{x.bundle.name}</Link>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ActionForm>
      ) : <Empty title={filtered ? "No bridges match" : "No bridges yet"}>{!filtered && "Import a bridge list (NBI or a county list), such as the Bridge List tab of the Quandel target lists."}</Empty>}
    </>
  );
}
