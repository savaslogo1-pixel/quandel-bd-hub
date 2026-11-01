import { ActionForm } from "@/components/ActionForm";
import { Confirm, PageHeader, VerifiedBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canEditRules } from "@/lib/permissions";
import { verification } from "@/lib/programs";
import { requireUser } from "@/lib/session";
import { createRule, updateRule } from "./actions";

export const metadata = { title: "State rules" };

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ j?: string }> }) {
  const { j } = await searchParams;
  const user = await requireUser();
  const all = await prisma.stateRule.findMany({ include: { lastVerifiedBy: { select: { name: true, email: true } } }, orderBy: [{ jurisdiction: "asc" }, { topic: "asc" }, { key: "asc" }] });
  const rules = j ? all.filter((r) => r.jurisdiction === j) : all;
  const jurisdictions = [...new Set(all.map((r) => r.jurisdiction))];
  const needs = all.filter((r) => verification(r.lastVerifiedAt) !== "current").length;
  const edit = canEditRules(user.role);
  let last = "";
  return (
    <>
      <PageHeader
        title="State rules"
        sub="Thresholds, notice periods and waiting periods the app uses, stored as data with a source and a verification date. The approvals scheduler, multiple-prime check and compliance checks read these values by key."
      />
      {needs > 0 && <p className="banner banner-warn">{needs} of {all.length} rules are unverified or more than 12 months old. Check each against the statute, cite the source and mark it verified.</p>}
      <nav className="filters" aria-label="Jurisdiction">
        <a className={`btn btn-sm ${!j ? "btn-primary" : ""}`} href="/rules">All</a>
        {jurisdictions.map((x) => <a key={x} className={`btn btn-sm ${j === x ? "btn-primary" : ""}`} href={`/rules?j=${x}`}>{x}</a>)}
      </nav>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Topic</th><th>Rule</th><th className="num">Value</th><th>Key</th><th>Source</th><th>Verified</th></tr></thead>
          <tbody>
            {rules.flatMap((r) => {
              const out = [];
              if (r.jurisdiction !== last) {
                last = r.jurisdiction;
                out.push(<tr key={"g" + r.jurisdiction}><td colSpan={6} className="font-[family-name:var(--font-display)] text-sm uppercase tracking-wide" style={{ background: "var(--sunken)" }}>{r.jurisdiction}</td></tr>);
              }
              out.push(
                <tr key={r.id}>
                  <td className="text-xs">{r.topic}</td>
                  <td>
                    {r.text}
                    {edit && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs" style={{ color: "var(--brand)" }}>Edit or verify</summary>
                        <div className="mt-2 min-w-[300px]">
                          <ActionForm action={updateRule.bind(null, r.id)} className="form" submitLabel="Save rule">
                            <label className="field full"><span>Rule</span><input name="text" defaultValue={r.text} /></label>
                            <label className="field"><span>Value</span><input name="value" inputMode="decimal" defaultValue={r.value != null ? String(r.value) : ""} /></label>
                            <label className="field"><span>Unit</span><input name="unit" defaultValue={r.unit ?? ""} /></label>
                            <label className="field"><span>Topic</span><input name="topic" defaultValue={r.topic} /></label>
                            <label className="field full"><span>Source <span className="hint">statute, section, guidance and date</span></span><input name="source" defaultValue={r.source ?? ""} /></label>
                            <label className="check full"><input type="checkbox" name="markVerified" /> I checked this against the source today (sets Last verified)</label>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                  </td>
                  <td className="num">{r.value != null ? `${Number(r.value).toLocaleString("en-US")} ${r.unit ?? ""}` : r.unit ? <Confirm /> : ""}</td>
                  <td className="mono text-xs">{r.key}</td>
                  <td className="text-xs">{r.source ?? <Confirm />}</td>
                  <td><VerifiedBadge at={r.lastVerifiedAt} state={verification(r.lastVerifiedAt)} />{r.lastVerifiedBy && <div className="muted text-xs">{r.lastVerifiedBy.name ?? r.lastVerifiedBy.email}</div>}</td>
                </tr>,
              );
              return out;
            })}
          </tbody>
        </table>
      </div>
      {edit && (
        <details className="panel mt-4">
          <summary className="cursor-pointer font-semibold">Add a rule</summary>
          <p className="muted my-2 text-xs">New states are added the same way the course adds editions: add their rules here (and their approvals template in data/approval_templates.json).</p>
          <ActionForm action={createRule} className="form cols-3" submitLabel="Add rule">
            <label className="field"><span>Key</span><input name="key" placeholder="MD.prevailing_wage_threshold" /></label>
            <label className="field"><span>Jurisdiction</span><input name="jurisdiction" placeholder="MD" /></label>
            <label className="field"><span>Topic</span><input name="topic" placeholder="Prevailing wage" /></label>
            <label className="field full"><span>Rule</span><input name="text" /></label>
            <label className="field"><span>Value</span><input name="value" inputMode="decimal" /></label>
            <label className="field"><span>Unit</span><input name="unit" placeholder="$, days, hours, %" /></label>
            <label className="field"><span>Source</span><input name="source" /></label>
          </ActionForm>
        </details>
      )}
    </>
  );
}
