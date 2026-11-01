import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Confirm, Fact, VerifiedBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { daysFromToday, fmtDate, money } from "@/lib/format";
import { canEditOpportunities, canEditPrograms } from "@/lib/permissions";
import { stageName } from "@/lib/pipeline";
import { MATCH_BASIS_LABELS, PROGRAM_TYPE_LABELS, STACK_STATUSES, STACK_STATUS_LABELS, verification } from "@/lib/programs";
import { requireUser } from "@/lib/session";
import { addStackRow, markProgramVerified } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.fundingProgram.findUnique({ where: { id }, select: { name: true } });
  return { title: p?.name ?? "Program" };
}

export default async function ProgramPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await requireUser();
  const p = await prisma.fundingProgram.findUnique({
    where: { id },
    include: {
      lastVerifiedBy: { select: { name: true, email: true } },
      stackRows: { include: { opportunity: { select: { id: true, name: true, stage: true, org: { select: { name: true } } } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!p) notFound();
  // Opportunities to match: open ones, owners in this program's state first (or all for Federal).
  const opps = await prisma.opportunity.findMany({
    where: { stage: { lt: 9 } },
    select: { id: true, name: true, org: { select: { name: true, state: true } } },
    orderBy: { name: "asc" },
  });
  const sorted = [...opps].sort((a, b) => Number(b.org.state === p.jurisdiction) - Number(a.org.state === p.jurisdiction));
  const v = verification(p.lastVerifiedAt);
  const left = p.nextDeadline ? daysFromToday(p.nextDeadline) : null;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Funding program · {p.jurisdiction}</div>
          <h1 className="text-[28px] font-semibold">{p.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <VerifiedBadge at={p.lastVerifiedAt} state={v} />
            {p.lastVerifiedBy && <span className="muted text-xs">by {p.lastVerifiedBy.name ?? p.lastVerifiedBy.email}</span>}
            {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer">Program page</a>}
          </div>
        </div>
        {canEditPrograms(user.role) && (
          <div className="flex flex-wrap gap-2">
            {v !== "current" && <form action={markProgramVerified.bind(null, p.id)}><button className="btn">Mark verified today</button></form>}
            <Link className="btn" href={`/programs/${p.id}/edit`}>Edit</Link>
          </div>
        )}
      </div>
      {error === "in-use" && <p className="banner banner-bad">This program is on at least one capital stack. Remove it from those stacks before deleting it.</p>}
      {v !== "current" && <p className="banner banner-warn">Check these details against the current program guidelines before relying on them, then mark the program verified.</p>}
      <section className="panel facts mb-5">
        <Fact k="Agency">{p.agency ?? <Confirm />}</Fact>
        <Fact k="Type">{p.programType ? PROGRAM_TYPE_LABELS[p.programType] : <Confirm />}</Fact>
        <Fact k="Award range">{p.minAward != null || p.maxAward != null ? `${money(p.minAward)} – ${money(p.maxAward)}` : <Confirm />}</Fact>
        <Fact k="Match">{p.matchPct != null ? `${Number(p.matchPct)}% ${MATCH_BASIS_LABELS[p.matchBasis ?? "PROJECT_COST"]}${p.matchType ? ` · ${p.matchType}` : ""}` : <Confirm />}</Fact>
        <Fact k="Reimbursement">{p.reimbursement == null ? <Confirm /> : p.reimbursement ? "Yes, pays after the owner spends" : "No"}</Fact>
        <Fact k="Cycle">{p.cycle ?? <Confirm />}</Fact>
        <Fact k="Next deadline">{p.nextDeadline ? <>{fmtDate(p.nextDeadline)}{left != null && left >= 0 && <span className="muted text-xs"> · {left} days</span>}</> : <Confirm />}</Fact>
        <Fact k="Eligible applicants">{p.eligibleApplicants ?? <Confirm />}</Fact>
        <Fact k="Eligible uses">{p.eligibleUses ?? <Confirm />}</Fact>
        <Fact k="Source">{p.source ?? <Confirm />}</Fact>
        <Fact k="Notes">{p.notes ?? "—"}</Fact>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section>
          <h2 className="mb-1 text-lg">On capital stacks</h2>
          {p.stackRows.length ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Opportunity</th><th>Stage</th><th className="num">Amount</th><th>Status</th></tr></thead>
                <tbody>{p.stackRows.map((r) => (
                  <tr key={r.id}>
                    <td><Link className="rowlink" href={`/opportunities/${r.opportunity.id}?tab=stack`}>{r.opportunity.name}</Link><div className="muted text-xs">{r.opportunity.org.name}</div></td>
                    <td className="text-xs">{r.opportunity.stage} · {stageName(r.opportunity.stage)}</td>
                    <td className="num">{money(r.amount)}</td>
                    <td>{STACK_STATUS_LABELS[r.status]}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="muted">Not on any capital stack yet.</p>}
        </section>
        {canEditOpportunities(user.role) && (
          <section className="panel">
            <h2 className="mb-1 text-lg">Match to an opportunity</h2>
            <p className="muted mb-2 text-xs">Adds this program to the opportunity's capital stack. {p.jurisdiction !== "Federal" && `Owners in ${p.jurisdiction} are listed first.`}</p>
            {sorted.length ? (
              <ActionForm action={addStackRow} className="form" submitLabel="Add to capital stack">
                <input type="hidden" name="programId" value={p.id} />
                <input type="hidden" name="then" value="opp" />
                <label className="field full"><span>Opportunity</span>
                  <select name="opportunityId" defaultValue="">
                    <option value="">Choose…</option>
                    {sorted.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.org.name} ({o.org.state})</option>)}
                  </select>
                </label>
                <label className="field"><span>Planned amount ($)</span><input name="amount" inputMode="decimal" /></label>
                <label className="field"><span>Status</span><select name="status" defaultValue="IDEA">{STACK_STATUSES.map((s) => <option key={s} value={s}>{STACK_STATUS_LABELS[s]}</option>)}</select></label>
              </ActionForm>
            ) : <p className="muted">No open opportunities yet.</p>}
          </section>
        )}
      </div>
    </>
  );
}
