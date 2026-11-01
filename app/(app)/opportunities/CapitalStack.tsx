import Link from "next/link";
import type { StackStatus } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { Confirm, Empty } from "@/components/ui";
import { summarize, type StackRowInput } from "@/lib/capitalStack";
import { prisma } from "@/lib/db";
import { fmtDate, money, ymd } from "@/lib/format";
import { MATCH_BASIS_LABELS, OTHER_SOURCE_LABELS, STACK_STATUSES, STACK_STATUS_LABELS, verification } from "@/lib/programs";
import { addStackRow, addTemplateRows, deleteStackRow, updateStackRow } from "../programs/actions";

const STATUS_COLOR: Record<StackStatus, string> = {
  IDEA: "var(--muted)", APPLIED: "#5b9bd5", AWARDED: "var(--brand)", CLOSED: "var(--ok)", DENIED: "var(--bad)",
};

export async function CapitalStack({ oppId, orgState, projectCost, canEdit }: { oppId: string; orgState: string; projectCost: number | null; canEdit: boolean }) {
  const [rows, programs] = await Promise.all([
    prisma.capitalStackRow.findMany({ where: { opportunityId: oppId }, include: { program: true }, orderBy: { sortOrder: "asc" } }),
    prisma.fundingProgram.findMany({ select: { id: true, name: true, jurisdiction: true }, orderBy: [{ jurisdiction: "asc" }, { name: "asc" }] }),
  ]);
  const label = (r: (typeof rows)[number]) => r.program?.name ?? r.label ?? (r.otherSource ? OTHER_SOURCE_LABELS[r.otherSource] : "Source");
  const input: StackRowInput[] = rows.map((r) => ({
    id: r.id, label: label(r), amount: r.amount != null ? Number(r.amount) : null, status: r.status, reimbursementLagDays: r.reimbursementLagDays,
    program: r.program ? { id: r.program.id, name: r.program.name, matchPct: r.program.matchPct != null ? Number(r.program.matchPct) : null, matchBasis: r.program.matchBasis, reimbursement: r.program.reimbursement } : null,
  }));
  const s = summarize(input, projectCost);
  const denom = Math.max(projectCost ?? 0, s.total) || 1;
  const segs = input.filter((r) => r.status !== "DENIED" && (r.amount ?? 0) > 0);
  const local = programs.filter((p) => p.jurisdiction === orgState || p.jurisdiction === "Federal");
  const rest = programs.filter((p) => !(p.jurisdiction === orgState || p.jurisdiction === "Federal"));

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap gap-6">
        <Big k="Project cost" v={projectCost == null ? "—" : money(projectCost)} />
        <Big k="Sources" v={money(s.total)} sub="all but denied" />
        <Big k="Committed" v={money(s.committed)} sub="awarded + closed" />
        {s.gap != null && <Big k={s.gap > 0 ? "Gap" : s.gap < 0 ? "Over-funded by" : "Gap"} v={money(Math.abs(s.gap))} tone={s.gap > 0 ? "bad" : "ok"} />}
        {s.reimbursement.amount > 0 && <Big k="Cash to front" v={money(s.reimbursement.amount)} sub={`reimbursement programs${s.reimbursement.maxLagDays ? `, up to ${s.reimbursement.maxLagDays} days` : ""}`} tone="warn" />}
      </section>
      {projectCost == null && <p className="banner banner-warn">Set the estimated value on this opportunity (Edit) to see the gap and project-cost match checks.</p>}

      <section aria-label="Capital stack chart">
        <div className="flex h-7 overflow-hidden rounded border" style={{ borderColor: "var(--line)", background: "var(--sunken)" }} role="img" aria-label={`Sources ${money(s.total)} of ${money(projectCost)}`}>
          {segs.map((r) => (
            <div key={r.id} title={`${r.label}: ${money(r.amount)} (${STACK_STATUS_LABELS[r.status]})`} style={{ width: `${((r.amount ?? 0) / denom) * 100}%`, background: STATUS_COLOR[r.status], borderRight: "1px solid var(--surface)" }} />
          ))}
          {s.gap != null && s.gap > 0 && (
            <div title={`Gap ${money(s.gap)}`} style={{ width: `${(s.gap / denom) * 100}%`, background: "repeating-linear-gradient(45deg, var(--bad-soft) 0 6px, transparent 6px 12px)" }} />
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-3 text-xs" style={{ color: "var(--muted)" }}>
          {STACK_STATUSES.filter((st) => st !== "DENIED").map((st) => (
            <span key={st}><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: STATUS_COLOR[st] }} />{STACK_STATUS_LABELS[st]} {money(s.byStatus[st])}</span>
          ))}
          {s.gap != null && s.gap > 0 && <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: "var(--bad-soft)", outline: "1px solid var(--bad)" }} />Gap</span>}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg">Sources</h2>
        {rows.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Source</th><th className="num">Amount</th><th>Status</th><th>Applied</th><th>Awarded</th><th className="num">Reimb. lag</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={r.status === "DENIED" ? { opacity: 0.6 } : undefined}>
                    <td>
                      {r.program ? <Link className="rowlink" href={`/programs/${r.program.id}`}>{r.program.name}</Link> : <b>{label(r)}</b>}
                      <div className="muted text-xs">
                        {r.program ? `${r.program.jurisdiction} program` : r.otherSource && r.label ? OTHER_SOURCE_LABELS[r.otherSource] : ""}
                        {r.program && r.label ? ` · ${r.label}` : ""}
                        {r.program && verification(r.program.lastVerifiedAt) !== "current" && <span className="chip chip-warn ml-1">program unverified</span>}
                      </div>
                      {canEdit && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs" style={{ color: "var(--brand)" }}>Edit</summary>
                          <div className="mt-2 min-w-[320px]">
                            <ActionForm action={updateStackRow.bind(null, r.id)} className="form" submitLabel="Save row">
                              <label className="field"><span>Amount ($)</span><input name="amount" inputMode="decimal" defaultValue={r.amount != null ? String(r.amount) : ""} /></label>
                              <label className="field"><span>Status</span><select name="status" defaultValue={r.status}>{STACK_STATUSES.map((st) => <option key={st} value={st}>{STACK_STATUS_LABELS[st]}</option>)}</select></label>
                              <label className="field"><span>Applied</span><input type="date" name="applicationDate" defaultValue={ymd(r.applicationDate)} /></label>
                              <label className="field"><span>Awarded</span><input type="date" name="awardDate" defaultValue={ymd(r.awardDate)} /></label>
                              <label className="field"><span>Reimbursement lag (days)</span><input name="reimbursementLagDays" inputMode="numeric" defaultValue={r.reimbursementLagDays ?? ""} /></label>
                              <label className="field"><span>Label</span><input name="label" defaultValue={r.label ?? ""} /></label>
                              <label className="field full"><span>Notes</span><textarea name="notes" defaultValue={r.notes ?? ""} /></label>
                            </ActionForm>
                          </div>
                        </details>
                      )}
                    </td>
                    <td className="num">{r.amount != null ? money(r.amount) : <span className="muted">—</span>}</td>
                    <td><span className="chip" style={{ color: STATUS_COLOR[r.status] }}>{STACK_STATUS_LABELS[r.status]}</span></td>
                    <td className="mono text-xs">{fmtDate(r.applicationDate)}</td>
                    <td className="mono text-xs">{fmtDate(r.awardDate)}</td>
                    <td className="num">{r.reimbursementLagDays != null ? `${r.reimbursementLagDays} d` : r.program?.reimbursement ? <Confirm /> : ""}</td>
                    <td>{canEdit && <form action={deleteStackRow.bind(null, r.id)}><button className="btn btn-sm btn-danger" aria-label={`Remove ${label(r)}`}>Remove</button></form>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No sources yet">Add a program from the library or another source such as a bond or capital reserve.</Empty>}
      </section>

      {canEdit && (
        <section className="panel">
          <h2 className="mb-2 text-base">Add a source</h2>
          <ActionForm action={addStackRow} className="form cols-3" submitLabel="Add source" extraButtons={null}>
            <input type="hidden" name="opportunityId" value={oppId} />
            <label className="field"><span>Library program</span>
              <select name="programId" defaultValue="">
                <option value="">— or pick another source →</option>
                <optgroup label={`${orgState} and Federal`}>{local.map((p) => <option key={p.id} value={p.id}>{p.jurisdiction} · {p.name}</option>)}</optgroup>
                <optgroup label="Other states">{rest.map((p) => <option key={p.id} value={p.id}>{p.jurisdiction} · {p.name}</option>)}</optgroup>
              </select>
            </label>
            <label className="field"><span>Other source</span>
              <select name="otherSource" defaultValue=""><option value="">—</option>{Object.entries(OTHER_SOURCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </label>
            <label className="field"><span>Label <span className="hint">optional</span></span><input name="label" placeholder="e.g., 2027 GO bond" /></label>
            <label className="field"><span>Amount ($)</span><input name="amount" inputMode="decimal" /></label>
            <label className="field"><span>Status</span><select name="status" defaultValue="IDEA">{STACK_STATUSES.map((st) => <option key={st} value={st}>{STACK_STATUS_LABELS[st]}</option>)}</select></label>
            <label className="field"><span>Reimbursement lag (days)</span><input name="reimbursementLagDays" inputMode="numeric" /></label>
          </ActionForm>
          <form action={addTemplateRows.bind(null, oppId)} className="mt-2">
            <button className="btn btn-sm">Start from the illustrative template</button>
            <span className="muted ml-2 text-xs">Adds placeholder rows (state grant, federal grant, bond or note, capital reserve) with no amounts.</span>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-1 text-lg">Match check</h2>
        {s.matches.length ? (
          <ul className="rows panel">
            {s.matches.map((m) => (
              <li key={m.rowId}>
                <div className="min-w-0 flex-1">
                  <b>{m.program}</b>
                  <div className="text-[13px]">
                    {m.state === "no_rule"
                      ? <>No match requirement in the library yet <Confirm /></>
                      : <>Needs {money(m.required)} ({m.pct}% {MATCH_BASIS_LABELS[m.basis!]}); the other sources total {money(m.available)}.</>}
                  </div>
                </div>
                <span className={`chip ${m.state === "met" ? "chip-ok" : m.state === "short" ? "chip-bad" : "chip-warn"}`}>
                  {m.state === "met" ? "Match met" : m.state === "short" ? `Short ${money(m.shortBy)}` : "No rule"}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">Add a library program to check its match rule.</p>}
        <p className="muted mt-1 text-xs">The check counts every other non-denied source as match. If a program limits what counts (for example, only non-state funds), confirm the sources by hand.</p>
      </section>
    </div>
  );
}

function Big({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: "bad" | "ok" | "warn" }) {
  return (
    <div className="flex flex-col">
      <span className="eyebrow">{k}</span>
      <b className="font-[family-name:var(--font-display)] text-[24px] font-semibold leading-tight" style={tone ? { color: `var(--${tone})` } : undefined}>{v}</b>
      {sub && <span className="muted text-xs">{sub}</span>}
    </div>
  );
}
