import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { ExportLinks } from "@/components/ExportLinks";
import { Confirm, Empty, PageHeader } from "@/components/ui";
import { lobbyingTotals } from "@/lib/complianceData";
import { STATES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fmtDate, money } from "@/lib/format";
import { canReviewCompliance } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { attestedThisYear } from "@/lib/training/progress";
import { deleteLobbying, logLobbying } from "../actions";

export const metadata = { title: "Lobbying" };

const STATE_CHIP = { ok: ["chip-ok", "Below"], near: ["chip-warn", "⚠ Near"], over: ["chip-bad", "⛔ At or over"], unknown: ["", "No threshold"] } as const;

export default async function LobbyingPage() {
  const user = await requireUser();
  const reviewer = canReviewCompliance(user.role);
  const year = new Date().getUTCFullYear();
  const [totals, entries, att] = await Promise.all([
    lobbyingTotals(year),
    prisma.lobbyingEntry.findMany({ where: reviewer ? {} : { userId: user.id }, include: { user: true }, orderBy: { date: "desc" }, take: 300 }),
    attestedThisYear(user.id),
  ]);
  return (
    <>
      <PageHeader title="Lobbying" sub={`Time and spending on lobbying, by jurisdiction, against registration thresholds from State rules (warning at 80%). Thresholds compare reportable compensation and expenses for ${year}.`} actions={reviewer && <ExportLinks table="lobbying" />} />
      <section className="mb-5">
        <h2 className="mb-1 text-lg">{year} by jurisdiction</h2>
        {totals.length ? (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Jurisdiction</th><th className="num">Hours</th><th className="num">Compensation + expenses</th><th className="num">Threshold</th><th>Use of threshold</th><th>Status</th></tr></thead>
            <tbody>{totals.map((t) => (
              <tr key={t.jurisdiction}>
                <td><b>{t.jurisdiction}</b></td>
                <td className="num">{t.hours.toLocaleString()}</td>
                <td className="num">{money(t.spend)}</td>
                <td className="num">{t.threshold != null ? money(t.threshold) : <Confirm />}</td>
                <td>{t.status.pct != null ? (
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-40 overflow-hidden rounded" style={{ background: "var(--sunken)" }} role="img" aria-label={`${Math.round(t.status.pct)}% of threshold`}>
                      <div className="h-full" style={{ width: `${Math.min(100, t.status.pct)}%`, background: t.status.state === "over" ? "var(--bad)" : t.status.state === "near" ? "var(--warn)" : "var(--ok)", borderRadius: "0 4px 4px 0" }} />
                    </div>
                    <span className="mono text-xs">{Math.round(t.status.pct)}%</span>
                  </div>
                ) : <span className="muted text-xs">set the threshold on State rules</span>}</td>
                <td><span className={`chip ${STATE_CHIP[t.status.state][0]}`}>{STATE_CHIP[t.status.state][1]}</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted">Nothing logged in {year}.</p>}
      </section>
      {att ? (
        <details className="panel mb-5"><summary className="cursor-pointer font-semibold">Log lobbying</summary><div className="mt-3">
          <ActionForm action={logLobbying} className="form cols-3" submitLabel="Log it">
            <label className="field"><span>Date</span><input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <label className="field"><span>Jurisdiction</span><select name="jurisdiction" defaultValue="PA">{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="field"><span>Hours</span><input name="hours" inputMode="decimal" /></label>
            <label className="field"><span>Compensation + expenses ($)</span><input name="expenses" inputMode="decimal" /></label>
            <label className="field full"><span>Subject</span><input name="subject" placeholder="bill, program or decision" /></label>
            <label className="field full"><span>Officials contacted</span><input name="officials" /></label>
            <label className="field full"><span>Notes</span><textarea name="notes" /></label>
          </ActionForm>
        </div></details>
      ) : <p className="banner banner-warn">Sign this year's ethics attestation before logging lobbying. <Link href="/training">Go to My learning</Link></p>}
      {entries.length ? (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Date</th><th>Jurisdiction</th><th>Subject</th><th className="num">Hours</th><th className="num">$</th><th>By</th><th /></tr></thead>
          <tbody>{entries.map((e) => (
            <tr key={e.id}><td className="mono text-xs">{fmtDate(e.date)}</td><td>{e.jurisdiction}</td><td className="text-[13px]">{e.subject}{e.officials && <div className="muted text-xs">{e.officials}</div>}</td><td className="num">{Number(e.hours)}</td><td className="num">{money(e.expenses)}</td><td className="text-xs">{e.user.name ?? e.user.email}</td>
              <td>{(reviewer || e.userId === user.id) && <form action={deleteLobbying.bind(null, e.id)}><button className="btn btn-sm btn-danger" aria-label="Delete entry">×</button></form>}</td></tr>
          ))}</tbody>
        </table></div>
      ) : <Empty title="No lobbying logged" />}
    </>
  );
}
