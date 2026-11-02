import Link from "next/link";
import { HBars, PHASES, Stat, StackedHBars, companyColor } from "@/components/Charts";
import { ExportLinks } from "@/components/ExportLinks";
import { CompanyTag, Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { bundlesData, checklistDone, complianceData, coverageData, fundingData, mvDue, pipelineData, qesFigures, trainingData, upcoming, winRates, type PipeOpp } from "@/lib/dashboard";
import { fmtDate, money } from "@/lib/format";
import { STAGES, deliveryLabel, stageName } from "@/lib/pipeline";
import { companies as loadCompanies } from "@/lib/picklists";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Dashboard" };

const short = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const pct = (x: number | null | undefined) => (x == null || Number.isNaN(x) ? "—" : `${Math.round(x * 100)}%`);

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = "enterprise" } = await searchParams;
  await requireUser();
  const [cos, opps] = await Promise.all([loadCompanies(), pipelineData()]);
  const views: [string, string][] = [["enterprise", "Enterprise"], ...cos.filter((c) => !c.isParent).map((c) => [c.code, c.code] as [string, string])];
  return (
    <>
      <PageHeader title="Dashboards" sub="Pipeline, funding, coverage, training and compliance across Quandel Enterprises. Opportunities count under their lead company; weighted value is Quandel scope (or estimated value) × probability." />
      <nav className="tabs" aria-label="Dashboard">
        {views.map(([k, l]) => <Link key={k} href={k === "enterprise" ? "/dashboard" : `/dashboard?view=${k}`} aria-current={view === k ? "page" : undefined}>{k === "enterprise" ? l : <span className="inline-flex items-center gap-1.5"><CompanyTag code={k} />{cos.find((c) => c.code === k)?.name}</span>}</Link>)}
      </nav>
      {view === "enterprise" ? <Enterprise opps={opps} cos={cos} /> : <CompanyView code={view} opps={opps} name={cos.find((c) => c.code === view)?.name ?? view} />}
    </>
  );
}

async function Enterprise({ opps, cos }: { opps: PipeOpp[]; cos: { code: string; name: string }[] }) {
  const [funding, coverage, training, compliance] = await Promise.all([fundingData(), coverageData(), trainingData(), complianceData()]);
  const open = opps.filter((o) => o.stage < 9);
  const joint = open.filter((o) => o.supportCompanies.length > 0);
  const decided = opps.filter((o) => o.outcome === "WON" || o.outcome === "LOST");
  const wins = decided.filter((o) => o.outcome === "WON").length;
  const byCo = cos.map((c) => {
    const mine = open.filter((o) => o.leadCompany.code === c.code);
    return {
      c, count: mine.length, value: mine.reduce((a, o) => a + Number(o.estimatedValue ?? 0), 0), weighted: mine.reduce((a, o) => a + o.weighted, 0),
      byStage: Object.fromEntries(STAGES.filter((s) => s.n < 9).map((s) => [s.n, mine.filter((o) => o.stage === s.n)])),
      phases: PHASES.map((p) => ({ ...p, opps: mine.filter((o) => p.stages.includes(o.stage)) })),
    };
  });
  const wr = winRates(opps);
  const pairs = new Map<string, number>();
  for (const o of joint) for (const s of o.supportCompanies) pairs.set(`${o.leadCompany.code}→${s.code}`, (pairs.get(`${o.leadCompany.code}→${s.code}`) ?? 0) + 1);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat value={String(open.length)} label="Open opportunities" href="/pipeline" />
        <Stat value={short(open.reduce((a, o) => a + Number(o.estimatedValue ?? 0), 0))} label="Open estimated value" />
        <Stat value={short(open.reduce((a, o) => a + o.weighted, 0))} label="Weighted pipeline" />
        <Stat value={String(joint.length)} label="Joint pursuits (cross-sell)" />
        <Stat value={decided.length ? pct(wins / decided.length) : "—"} label="Win rate" note={`${wins} won of ${decided.length} decided`} />
        <Stat value={coverage.total ? pct(coverage.covered / coverage.total) : "—"} label="Tier A coverage" note={`${coverage.covered} of ${coverage.total}`} />
        <Stat value={String(compliance.stop + compliance.check)} label="Open compliance flags" note={`${compliance.stop} stop · ${compliance.check} check`} href="/compliance" tone={compliance.stop ? "bad" : undefined} />
      </div>

      <section className="panel">
        <div className="mb-3 flex flex-wrap items-baseline gap-2"><h2 className="flex-1 text-lg">Weighted pipeline by company and phase</h2><ExportLinks table="opportunities" /></div>
        <StackedHBars
          ariaLabel="Weighted open pipeline by lead company, split by pipeline phase"
          rows={byCo.map((r) => ({
            key: r.c.code, label: r.c.code, total: `${short(r.weighted)} · ${r.count} open`,
            segments: r.phases.map((p) => ({ key: p.key, value: p.opps.reduce((a, o) => a + o.weighted, 0), color: p.color, title: `${r.c.code} · ${p.label}: ${short(p.opps.reduce((a, o) => a + o.weighted, 0))} weighted, ${p.opps.length} opportunities` })),
          }))}
          legend={PHASES.map((p) => ({ label: p.label, color: p.color }))}
        />
        <div className="tbl-wrap mt-4">
          <table className="tbl">
            <thead><tr><th>Company</th>{STAGES.filter((s) => s.n < 9).map((s) => <th key={s.n} className="num" title={s.name}>{s.n}</th>)}<th className="num">Open</th><th className="num">Value</th><th className="num">Weighted</th></tr></thead>
            <tbody>
              {byCo.map((r) => (
                <tr key={r.c.code}>
                  <td><Link href={`/dashboard?view=${r.c.code}`} className="inline-flex items-center gap-1.5"><CompanyTag code={r.c.code} /> {r.c.name}</Link></td>
                  {STAGES.filter((s) => s.n < 9).map((s) => <td key={s.n} className="num">{r.byStage[s.n].length || <span className="muted">·</span>}</td>)}
                  <td className="num"><b>{r.count}</b></td><td className="num">{money(r.value)}</td><td className="num">{money(r.weighted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted mt-1 text-xs">Stage columns: {STAGES.filter((s) => s.n < 9).map((s) => `${s.n} ${s.name}`).join(" · ")}.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel">
          <h2 className="mb-2 text-lg">Win rate by delivery method</h2>
          {wr.length ? (
            <>
              <HBars ariaLabel="Win rate by delivery method" max={1} rows={wr.map((w) => ({ key: w.dm, label: w.dm === "NONE" ? "Not set" : deliveryLabel(w.dm as never), value: w.rate, color: "var(--brand)", display: `${pct(w.rate)} (${w.won} of ${w.won + w.lost})` }))} />
              <table className="tbl mt-3"><thead><tr><th>Delivery method</th><th className="num">Won</th><th className="num">Lost</th><th className="num">Win rate</th></tr></thead>
                <tbody>{wr.map((w) => <tr key={w.dm}><td>{w.dm === "NONE" ? "Not set" : deliveryLabel(w.dm as never)}</td><td className="num">{w.won}</td><td className="num">{w.lost}</td><td className="num">{pct(w.rate)}</td></tr>)}</tbody></table>
            </>
          ) : <p className="muted">Record Won or Lost results to see win rates.</p>}
        </section>
        <section className="panel">
          <h2 className="mb-2 text-lg">Cross-sell: joint pursuits</h2>
          {joint.length ? (
            <table className="tbl"><thead><tr><th>Lead → support</th><th className="num">Open pursuits</th></tr></thead>
              <tbody>{[...pairs].sort((a, b) => b[1] - a[1]).map(([k, v]) => { const [l, s] = k.split("→"); return <tr key={k}><td><span className="inline-flex items-center gap-1"><CompanyTag code={l} /> → <CompanyTag code={s} /></span></td><td className="num">{v}</td></tr>; })}</tbody></table>
          ) : <p className="muted">No joint pursuits yet. Routing suggests support companies on each opportunity.</p>}
        </section>
      </div>

      <section className="panel">
        <div className="mb-2 flex flex-wrap items-baseline gap-2"><h2 className="flex-1 text-lg">Funding for clients</h2><ExportLinks table="capital-stacks" /></div>
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat value={short(funding.planned)} label="Planned (idea)" /><Stat value={short(funding.applied)} label="Applied, pending" /><Stat value={short(funding.awarded)} label="Awarded" /><Stat value={short(funding.denied)} label="Denied" />
        </div>
        <h3 className="mb-1 text-base">Program deadlines in the next 90 days</h3>
        {funding.soon.length ? (
          <ul className="rows">{funding.soon.slice(0, 10).map((r) => <li key={r.id}><span><Link href={`/programs/${r.program!.id}`} className="font-semibold">{r.program!.name}</Link> <span className="muted text-xs">for <Link href={`/opportunities/${r.opportunity.id}?tab=stack`}>{r.opportunity.name}</Link></span></span><span className="mono text-xs">{fmtDate(r.program!.nextDeadline)}</span></li>)}</ul>
        ) : <p className="muted">None on open capital stacks.</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel">
          <h2 className="mb-1 text-lg">Tier A coverage</h2>
          <p className="muted mb-2 text-xs">Covered = a decision map (at least one contact with a decision role) and a touch in the last 60 days.</p>
          {coverage.total ? (
            <>
              <HBars ariaLabel="Tier A coverage" max={coverage.total} rows={[
                { key: "covered", label: "Both", value: coverage.covered, color: "var(--ok)", display: `${coverage.covered} of ${coverage.total}` },
                { key: "mapped", label: "Decision map", value: coverage.mapped, color: "var(--brand)", display: `${coverage.mapped}` },
                { key: "touched", label: "Touched in 60 days", value: coverage.touched, color: "var(--brand)", display: `${coverage.touched}` },
              ]} />
              {coverage.gaps.length > 0 && <><h3 className="mb-1 mt-3 text-base">Gaps</h3><ul className="rows">{coverage.gaps.slice(0, 12).map((g) => <li key={g.id}><Link href={`/organizations/${g.id}`}>{g.name}</Link><span className="text-xs">{!g.mapped && <span className="chip chip-warn mr-1">no decision map</span>}{!g.touched && <span className="chip chip-warn">no touch in 60 days</span>}</span></li>)}</ul>{coverage.gaps.length > 12 && <p className="muted text-xs"><Link href="/organizations?tier=A">All Tier A organizations</Link></p>}</>}
            </>
          ) : <p className="muted">No Tier A organizations yet.</p>}
        </section>
        <section className="panel">
          <div className="mb-2 flex flex-wrap items-baseline gap-2"><h2 className="flex-1 text-lg">Training completion by company</h2><Link className="text-xs" href="/training/gradebook">Gradebook</Link></div>
          {training.byCompany.size ? (
            <>
              <HBars ariaLabel="Training completion by company" max={1} rows={[...cos.map((c) => c.code), "(none)"].filter((k) => training.byCompany.get(k)).map((k) => { const t = training.byCompany.get(k)!; return { key: k, label: k === "(none)" ? "No company tag" : k, value: t.total ? t.done / t.total : 0, color: k === "(none)" ? "var(--muted)" : companyColor(k), display: `${pct(t.total ? t.done / t.total : 0)} · ${t.people} ${t.people === 1 ? "person" : "people"}` }; })} />
              {training.byCompany.has("(none)") && <p className="muted mt-2 text-xs">Set company tags on the Admin page so completion rolls up by company.</p>}
            </>
          ) : <p className="muted">No active people yet.</p>}
          <p className="mt-3 text-[13px]">Quiz average: <b>{training.quizAvg != null ? `${Math.round(training.quizAvg)}%` : "—"}</b> over {training.attempts} attempts · Deliverables awaiting review: <Link href="/training/review"><b>{training.waiting}</b></Link></p>
        </section>
      </div>

      <section className="panel">
        <div className="mb-2 flex flex-wrap items-baseline gap-2"><h2 className="flex-1 text-lg">Compliance</h2><Link className="text-xs" href="/compliance">All flags</Link></div>
        <p className="mb-2">{compliance.stop ? <span className="chip chip-bad">⛔ {compliance.stop} stop</span> : <span className="chip chip-ok">No stop flags</span>} <span className="chip chip-warn">⚠ {compliance.check} to check</span></p>
        {compliance.lob.length ? (
          <table className="tbl"><thead><tr><th>Lobbying {new Date().getUTCFullYear()}</th><th className="num">Hours</th><th className="num">Compensation + expenses</th><th className="num">Threshold</th><th className="num">Used</th></tr></thead>
            <tbody>{compliance.lob.map((l) => <tr key={l.jurisdiction}><td>{l.jurisdiction}</td><td className="num">{l.hours}</td><td className="num">{money(l.spend)}</td><td className="num">{l.threshold != null ? money(l.threshold) : "[confirm]"}</td><td className="num">{l.status.pct != null ? `${Math.round(l.status.pct)}%` : "—"}{l.status.state === "over" ? " ⛔" : l.status.state === "near" ? " ⚠" : ""}</td></tr>)}</tbody></table>
        ) : <p className="muted">No lobbying logged this year.</p>}
      </section>
    </div>
  );
}

async function CompanyView({ code, opps, name }: { code: string; opps: PipeOpp[]; name: string }) {
  const mine = opps.filter((o) => o.codes.includes(code));
  const open = mine.filter((o) => o.stage < 9);
  const led = open.filter((o) => o.leadCompany.code === code);
  const year = new Date().getUTCFullYear();
  const wonThisYear = mine.filter((o) => o.outcome === "WON" && o.updatedAt.getUTCFullYear() === year);
  const stageRows = STAGES.filter((s) => s.n < 9).map((s) => { const xs = open.filter((o) => o.stage === s.n); return { key: String(s.n), label: `${s.n} ${s.name}`, value: xs.length, color: companyColor(code), display: xs.length ? `${xs.length} · ${short(xs.reduce((a, o) => a + o.weighted, 0))}` : "0" }; });
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat value={String(open.length)} label={`Open pursuits with ${code}`} note={`${led.length} as lead`} href={`/pipeline?co=${code}`} />
        <Stat value={short(led.reduce((a, o) => a + o.weighted, 0))} label="Weighted (as lead)" />
        <Stat value={short(led.reduce((a, o) => a + Number(o.estimatedValue ?? 0), 0))} label="Estimated value (as lead)" />
        <Stat value={String(open.filter((o) => o.codes.length > 1).length)} label="Joint pursuits" />
        <Stat value={String(wonThisYear.length)} label={`Won in ${year}`} />
      </div>
      <section className="panel">
        <h2 className="mb-2 text-lg">{code} open pursuits by stage</h2>
        {open.length ? <HBars ariaLabel={`${code} open pursuits by stage`} rows={stageRows} /> : <Empty title={`No open pursuits with ${code}`} />}
      </section>
      {code === "QCG" && <QcgPanels open={open} />}
      {code === "QES" && <QesPanels opps={opps} />}
      {code === "PCS" && <PcsPanels open={open} />}
      {code === "JVS" && <JvsPanels open={open} />}
      {code === "PYR" && <p className="banner banner-warn">Pyramid's dashboard metrics aren't defined in the spec yet [confirm]. This view shows the shared pipeline figures above.</p>}
      <OppTable title={`Open pursuits with ${name}`} opps={open} />
    </div>
  );
}

function OppTable({ title, opps, extra }: { title: string; opps: PipeOpp[]; extra?: (o: PipeOpp) => React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-lg">{title}</h2>
      {opps.length ? (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Opportunity</th><th>Owner</th><th>Team</th><th>Stage</th><th>Delivery</th><th className="num">Value</th><th className="num">Weighted</th>{extra && <th />}</tr></thead>
          <tbody>{opps.map((o) => (
            <tr key={o.id}><td><Link className="rowlink" href={`/opportunities/${o.id}`}>{o.name}</Link></td><td className="text-xs">{o.org.name} · {o.org.state}</td><td><span className="inline-flex gap-1">{o.codes.map((c, i) => <CompanyTag key={c} code={c} lead={i === 0} />)}</span></td><td className="text-xs">{o.stage} {stageName(o.stage)}</td><td className="text-xs">{deliveryLabel(o.deliveryMethod)}{checklistDone(o) && <span className="muted"> · {checklistDone(o)}</span>}</td><td className="num">{money(o.estimatedValue)}</td><td className="num">{money(o.weighted)}</td>{extra && <td className="text-xs">{extra(o)}</td>}</tr>
          ))}</tbody>
        </table></div>
      ) : <p className="muted">None.</p>}
    </section>
  );
}

function QcgPanels({ open }: { open: PipeOpp[] }) {
  const bids = [
    ...upcoming(open, "preBidDate").map((o) => ({ o, kind: "Pre-bid", date: o.preBidDate! })),
    ...upcoming(open, "dueDate").map((o) => ({ o, kind: "Due", date: o.dueDate! })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  const cm = upcoming(open.filter((o) => o.deliveryMethod === "CM_AGENCY" || o.deliveryMethod === "CM_AT_RISK"), "interviewDate", 120);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel"><h2 className="mb-1 text-lg">Bid calendar (90 days)</h2>
        {bids.length ? <ul className="rows">{bids.map((b) => <li key={b.o.id + b.kind}><Link href={`/opportunities/${b.o.id}`}>{b.o.name}</Link><span className="mono text-xs">{b.kind} {fmtDate(b.date)}</span></li>)}</ul> : <p className="muted">No pre-bid or due dates in the next 90 days.</p>}
      </section>
      <section className="panel"><h2 className="mb-1 text-lg">CM interviews</h2>
        {cm.length ? <ul className="rows">{cm.map((o) => <li key={o.id}><Link href={`/opportunities/${o.id}`}>{o.name}</Link><span className="mono text-xs">{fmtDate(o.interviewDate)}</span></li>)}</ul> : <p className="muted">No CM agency or CM-at-risk interviews scheduled.</p>}
      </section>
    </div>
  );
}

async function QesPanels({ opps }: { opps: PipeOpp[] }) {
  const f = qesFigures(opps);
  const mv = await mvDue();
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat value={String(f.energy.filter((o) => o.stage < 9).length)} label="Open GESA / EPC pursuits" />
        <Stat value={String(f.auditsInProgress.length)} label="Audits in progress" note="audit agreement done, investment-grade audit not yet" />
        <Stat value={`${short(f.savingsUnderManagement)}/yr`} label="Guaranteed savings under management" note={`${f.underManagement.length} won energy contracts`} />
        <Stat value={String(mv.length)} label="M&V reports due in 60 days" tone={mv.some((r) => r.dueDate! < new Date()) ? "bad" : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <OppTable title="Audits in progress" opps={f.auditsInProgress} />
        <section><h2 className="mb-1 text-lg">M&V due</h2>
          {mv.length ? <ul className="rows panel">{mv.map((r) => <li key={r.id}><span><Link href={`/opportunities/${r.opportunity.id}?tab=energy`}>{r.opportunity.name}</Link> <span className="muted text-xs">year {r.year}</span></span><span className={`chip ${r.dueDate! < new Date() ? "chip-bad" : ""}`}>{fmtDate(r.dueDate)}</span></li>)}</ul> : <p className="muted">Nothing due in 60 days.</p>}
        </section>
      </div>
    </>
  );
}

async function PcsPanels({ open }: { open: PipeOpp[] }) {
  const dot = open.filter((o) => o.org.orgType === "DOT");
  const bundles = await bundlesData();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <OppTable title="DOT lettings" opps={dot} extra={(o) => (o.dueDate ? `letting ${fmtDate(o.dueDate)}` : "")} />
      <section><h2 className="mb-1 text-lg">Bridge bundles</h2>
        {bundles.length ? (
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Bundle</th><th className="num">Bridges</th><th className="num">Estimate</th><th>Status</th></tr></thead>
            <tbody>{bundles.map((b) => <tr key={b.id}><td><Link href={`/bridges/bundles/${b.id}`}>{b.name}</Link>{b.opportunity && <div className="muted text-xs">→ {b.opportunity.name}</div>}</td><td className="num">{b.bridges.length}</td><td className="num">{money(b.est.total)}{b.est.missing > 0 && <div className="muted text-xs">{b.est.missing} missing</div>}</td><td className="text-xs">{b.status}</td></tr>)}</tbody></table></div>
        ) : <p className="muted">No bundles yet. <Link href="/bridges">Build one</Link></p>}
      </section>
    </div>
  );
}

function JvsPanels({ open }: { open: PipeOpp[] }) {
  const south = open.filter((o) => ["MD", "DC", "VA"].includes(o.org.state));
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {["MD", "DC", "VA"].map((s) => { const xs = south.filter((o) => o.org.state === s); return <Stat key={s} value={`${xs.length} · ${short(xs.reduce((a, o) => a + o.weighted, 0))}`} label={`${s} open pursuits · weighted`} />; })}
      </div>
      <OppTable title="MD / DC / VA pipeline" opps={south} />
    </>
  );
}
