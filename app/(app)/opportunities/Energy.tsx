import { ActionForm } from "@/components/ActionForm";
import { Empty } from "@/components/ui";
import { prisma } from "@/lib/db";
import { energyModel, frameworkFor, simplePayback } from "@/lib/energy";
import { fmtDate, money, todayUTC, ymd } from "@/lib/format";
import { loadRules } from "@/lib/rules";
import { addMeasure, createMvSchedule, deleteMeasure, saveEnergyTerms, updateMeasure, updateMv } from "./energyActions";

const n = (v: unknown) => (v == null ? null : Number(v));
const FW = { PA_GESA: "Pennsylvania GESA (62 Pa.C.S. § 3751 et seq.)", NY_EPC: "New York Energy Law § 9-103 EPC", HUD_EPC: "HUD energy performance contract" } as const;
const STATE_COLOR = { pass: "chip-ok", fail: "chip-bad", unknown: "chip-warn", info: "" } as const;
const STATE_LABEL = { pass: "Pass", fail: "Fail", unknown: "Needs input", info: "Note" } as const;

export async function Energy({ oppId, canEdit }: { oppId: string; canEdit: boolean }) {
  const [o, rules] = await Promise.all([
    prisma.opportunity.findUniqueOrThrow({ where: { id: oppId }, include: { org: true, leadCompany: true, supportCompanies: true, measures: { orderBy: { sortOrder: "asc" } }, mvReports: { orderBy: { year: "asc" } } } }),
    loadRules(),
  ]);
  const fw = frameworkFor(o.org.state, o.org.orgType);
  const m = energyModel({
    measures: o.measures.map((x) => ({ name: x.name, cost: n(x.cost), annualSavings: n(x.annualSavings), electivePayAmount: n(x.electivePayAmount) })),
    nonEnergyCost: n(o.nonEnergyCost), otherFunding: n(o.otherFunding), ratePct: n(o.financingRatePct), termYears: o.guaranteeTermYears,
    guaranteedOverride: n(o.guaranteedSavingsOverride), framework: fw, isSchool: o.org.orgType === "school district",
    rules: {
      paCostTestYears: rules["PA.gesa_cost_test_years"]?.value ?? null, paNonEnergyCapPct: rules["PA.gesa_non_energy_cap_pct"]?.value ?? null,
      paPublicNoticeDays: rules["PA.gesa_public_notice_days"]?.value ?? null, nyMaxTermYears: rules["NY.epc_max_term_years"]?.value ?? null,
      nySchoolPaybackYears: rules["NY.school_epc_payback_years"]?.value ?? null, hudMaxTermYears: rules["HUD.epc_max_term_years"]?.value ?? null,
    },
  });
  const isQES = [o.leadCompany.code, ...o.supportCompanies.map((c) => c.code)].includes("QES");
  const today = todayUTC();
  const mField = (x?: (typeof o.measures)[number]) => (
    <>
      <label className="field"><span>Measure</span><input name="name" defaultValue={x?.name ?? ""} placeholder="e.g., LED retrofit" /></label>
      <label className="field"><span>Category</span><input name="category" defaultValue={x?.category ?? ""} placeholder="lighting, HVAC, solar…" /></label>
      <label className="field"><span>Cost ($)</span><input name="cost" inputMode="decimal" defaultValue={x?.cost != null ? String(x.cost) : ""} /></label>
      <label className="field"><span>Guaranteed savings ($/yr)</span><input name="annualSavings" inputMode="decimal" defaultValue={x?.annualSavings != null ? String(x.annualSavings) : ""} /></label>
      <label className="field"><span>kWh saved / yr</span><input name="annualKwhSaved" inputMode="numeric" defaultValue={x?.annualKwhSaved ?? ""} /></label>
      <label className="field"><span>Therms saved / yr</span><input name="annualThermsSaved" inputMode="numeric" defaultValue={x?.annualThermsSaved ?? ""} /></label>
      <label className="check"><input type="checkbox" name="electivePayEligible" defaultChecked={x?.electivePayEligible} /> Elective-pay eligible</label>
      <label className="field"><span>Expected elective pay ($)</span><input name="electivePayAmount" inputMode="decimal" defaultValue={x?.electivePayAmount != null ? String(x.electivePayAmount) : ""} /></label>
      <label className="field"><span>Useful life (years)</span><input name="usefulLifeYears" inputMode="numeric" defaultValue={x?.usefulLifeYears ?? ""} /></label>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {!isQES && <p className="banner banner-info mb-0">The energy model is built for QES energy savings contracts. Add QES to the team to pursue this as an energy contract.</p>}
      <section className="panel facts">
        <div><div className="k">Rules applied</div><div className="v">{fw ? FW[fw] : `None loaded for ${o.org.state}`}</div></div>
        <div><div className="k">Owner baseline</div><div className="v">{o.org.annualUtilitySpend != null ? `${money(o.org.annualUtilitySpend)}/yr utilities` : "—"}{o.org.annualKwh != null && ` · ${o.org.annualKwh.toLocaleString()} kWh`}{o.org.eui != null && ` · EUI ${Number(o.org.eui)}`}</div></div>
        <div><div className="k">Project cost</div><div className="v">{money(m.projectCost)} <span className="muted text-xs">({money(m.energyCost)} energy + {money(m.nonEnergy)} non-energy)</span></div></div>
        <div><div className="k">Financed</div><div className="v">{money(m.financed)} <span className="muted text-xs">after {money(m.electivePay)} elective pay and {money(n(o.otherFunding) ?? 0)} other funding</span></div></div>
        <div><div className="k">Annual payment</div><div className="v">{m.payment != null ? money(m.payment) : "—"}</div></div>
        <div><div className="k">Guaranteed savings</div><div className="v">{money(m.guaranteed)}/yr{o.guaranteedSavingsOverride != null && <span className="muted text-xs"> (set directly)</span>}</div></div>
        <div><div className="k">Simple payback</div><div className="v">{m.payback != null ? `${m.payback.toFixed(1)} years` : "—"}</div></div>
      </section>

      <section>
        <h2 className="mb-1 text-lg">Checks</h2>
        <ul className="rows panel">
          {m.checks.map((c) => (
            <li key={c.key}><div className="min-w-0 flex-1"><b>{c.label}</b> <span className="text-[13px]">{c.detail}</span></div><span className={`chip ${STATE_COLOR[c.state]}`}>{STATE_LABEL[c.state]}</span></li>
          ))}
        </ul>
        <p className="muted mt-1 text-xs">Limits come from State rules ({["PA.gesa_cost_test_years", "PA.gesa_non_energy_cap_pct", "NY.epc_max_term_years", "NY.school_epc_payback_years", "HUD.epc_max_term_years"].filter((k) => rules[k] && !rules[k].lastVerifiedAt).length} of the values used are still unverified).</p>
      </section>

      {canEdit && (
        <section className="panel">
          <h2 className="mb-2 text-base">Contract terms</h2>
          <ActionForm action={saveEnergyTerms.bind(null, oppId)} className="form cols-3" submitLabel="Save terms">
            <label className="field"><span>Term (years)</span><input name="guaranteeTermYears" inputMode="numeric" defaultValue={o.guaranteeTermYears ?? ""} /></label>
            <label className="field"><span>Financing rate (%)</span><input name="financingRatePct" inputMode="decimal" defaultValue={o.financingRatePct != null ? String(o.financingRatePct) : ""} /></label>
            <label className="field"><span>IPMVP option</span><select name="ipmvpOption" defaultValue={o.ipmvpOption ?? ""}><option value="">—</option>{["A", "B", "C", "D"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="field"><span>Non-energy cost ($) <span className="hint">roof, ADA…</span></span><input name="nonEnergyCost" inputMode="decimal" defaultValue={o.nonEnergyCost != null ? String(o.nonEnergyCost) : ""} /></label>
            <label className="field"><span>Grants, rebates, cash ($)</span><input name="otherFunding" inputMode="decimal" defaultValue={o.otherFunding != null ? String(o.otherFunding) : ""} /></label>
            <label className="field"><span>Guaranteed savings ($/yr) <span className="hint">blank = sum of measures</span></span><input name="guaranteedSavingsOverride" inputMode="decimal" defaultValue={o.guaranteedSavingsOverride != null ? String(o.guaranteedSavingsOverride) : ""} /></label>
          </ActionForm>
        </section>
      )}

      <section>
        <h2 className="mb-1 text-lg">Energy conservation measures</h2>
        {o.measures.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Measure</th><th className="num">Cost</th><th className="num">Savings/yr</th><th className="num">Payback</th><th className="num">kWh</th><th className="num">Therms</th><th>Elective pay</th><th /></tr></thead>
              <tbody>
                {o.measures.map((x) => {
                  const pb = simplePayback(n(x.cost), n(x.annualSavings));
                  return (
                    <tr key={x.id}>
                      <td><b>{x.name}</b><div className="muted text-xs">{x.category}</div>
                        {canEdit && <details className="mt-1"><summary className="cursor-pointer text-xs" style={{ color: "var(--brand)" }}>Edit</summary><div className="mt-2 min-w-[320px]"><ActionForm action={updateMeasure.bind(null, x.id)} className="form" submitLabel="Save">{mField(x)}</ActionForm></div></details>}
                      </td>
                      <td className="num">{money(x.cost)}</td>
                      <td className="num">{money(x.annualSavings)}</td>
                      <td className="num">{pb != null ? `${pb.toFixed(1)} yr` : "—"}</td>
                      <td className="num">{x.annualKwhSaved?.toLocaleString() ?? ""}</td>
                      <td className="num">{x.annualThermsSaved?.toLocaleString() ?? ""}</td>
                      <td>{x.electivePayEligible ? <span className="chip chip-ok">eligible{x.electivePayAmount != null && ` · ${money(x.electivePayAmount)}`}</span> : ""}</td>
                      <td>{canEdit && <form action={deleteMeasure.bind(null, x.id)}><button className="btn btn-sm btn-danger">Remove</button></form>}</td>
                    </tr>
                  );
                })}
                <tr><td><b>Total</b></td><td className="num"><b>{money(m.energyCost)}</b></td><td className="num"><b>{money(m.measureSavings)}</b></td><td className="num">{m.payback != null ? `${m.payback.toFixed(1)} yr` : ""}</td><td colSpan={4} /></tr>
              </tbody>
            </table>
          </div>
        ) : <Empty title="No measures yet">Add the ECMs from the audit: cost, guaranteed savings, and whether elective pay applies.</Empty>}
        {canEdit && <details className="panel mt-2"><summary className="cursor-pointer font-semibold">Add a measure</summary><div className="mt-2"><ActionForm action={addMeasure.bind(null, oppId)} className="form cols-3" submitLabel="Add measure">{mField()}</ActionForm></div></details>}
      </section>

      <section>
        <h2 className="mb-1 text-lg">Measurement and verification</h2>
        {o.mvReports.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Year</th><th>Report due</th><th className="num">Guaranteed</th><th className="num">Actual</th><th className="num">Shortfall</th><th>Status</th></tr></thead>
              <tbody>
                {o.mvReports.map((r) => {
                  const g = n(r.guaranteedSavings), a = n(r.actualSavings);
                  const short = g != null && a != null ? Math.max(0, g - a) : null;
                  const overdue = r.status === "DUE" && r.dueDate && r.dueDate < today;
                  return (
                    <tr key={r.id}>
                      <td>Year {r.year}
                        {canEdit && <details className="mt-1"><summary className="cursor-pointer text-xs" style={{ color: "var(--brand)" }}>Update</summary><div className="mt-2 min-w-[300px]"><ActionForm action={updateMv.bind(null, r.id)} className="form" submitLabel="Save">
                          <label className="field"><span>Due</span><input type="date" name="dueDate" defaultValue={ymd(r.dueDate)} /></label>
                          <label className="field"><span>Status</span><select name="status" defaultValue={r.status}><option value="DUE">Due</option><option value="RECEIVED">Received</option><option value="REVIEWED">Reviewed</option></select></label>
                          <label className="field"><span>Guaranteed ($)</span><input name="guaranteedSavings" inputMode="decimal" defaultValue={g ?? ""} /></label>
                          <label className="field"><span>Actual ($)</span><input name="actualSavings" inputMode="decimal" defaultValue={a ?? ""} /></label>
                          <label className="field full"><span>Notes</span><textarea name="notes" defaultValue={r.notes ?? ""} /></label>
                        </ActionForm></div></details>}
                      </td>
                      <td>{fmtDate(r.dueDate)} {overdue && <span className="chip chip-bad">overdue</span>}</td>
                      <td className="num">{money(g)}</td>
                      <td className="num">{money(a)}</td>
                      <td className="num">{short == null ? "—" : short > 0 ? <span style={{ color: "var(--bad)" }}>{money(short)}</span> : "none"}</td>
                      <td><span className={`chip ${r.status === "REVIEWED" ? "chip-ok" : r.status === "RECEIVED" ? "chip-brand" : ""}`}>{r.status.toLowerCase()}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="muted mb-1">After award, set up the annual M&V reports to track guaranteed vs actual savings.</p>}
        {canEdit && !o.mvReports.length && (
          <div className="panel mt-2">
            <ActionForm action={createMvSchedule.bind(null, oppId)} className="form cols-3" submitLabel="Create M&V schedule">
              <label className="field"><span>Guarantee starts</span><input type="date" name="start" defaultValue={ymd(o.substantialCompletionDate)} /></label>
              <label className="field"><span>Years</span><input name="years" inputMode="numeric" defaultValue={o.guaranteeTermYears ?? ""} /></label>
              <label className="field"><span>Guaranteed savings ($/yr)</span><input name="guaranteed" inputMode="decimal" defaultValue={m.guaranteed || ""} /></label>
            </ActionForm>
          </div>
        )}
      </section>
    </div>
  );
}
