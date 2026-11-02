import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { ExportLinks } from "@/components/ExportLinks";
import { Confirm, Empty, PageHeader } from "@/components/ui";
import { GIFT_KINDS, giftLimitKey, giftOverLimit } from "@/lib/compliance";
import { STATES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fmtDate, money } from "@/lib/format";
import { canReviewCompliance } from "@/lib/permissions";
import { loadRules } from "@/lib/rules";
import { requireUser } from "@/lib/session";
import { attestedThisYear } from "@/lib/training/progress";
import { deleteGift, logGift, reviewGift } from "../actions";

export const metadata = { title: "Gifts and hospitality" };

export default async function GiftsPage() {
  const user = await requireUser();
  const reviewer = canReviewCompliance(user.role);
  const [gifts, rules, att, users, orgs] = await Promise.all([
    prisma.giftEntry.findMany({ where: reviewer ? {} : { giverId: user.id }, include: { giver: true, approver: true, reviewedBy: true, org: { select: { id: true, name: true } } }, orderBy: { date: "desc" }, take: 300 }),
    loadRules(), attestedThisYear(user.id),
    prisma.user.findMany({ where: { active: true, id: { not: user.id } }, orderBy: { name: "asc" } }),
    prisma.organization.findMany({ select: { id: true, name: true, state: true }, orderBy: { name: "asc" } }),
  ]);
  const limitText = STATES.map((s) => [s, rules[giftLimitKey(s)]?.value] as const).filter(([, v]) => v != null).map(([s, v]) => `${s} $${v}`).join(", ");
  return (
    <>
      <PageHeader title="Gifts and hospitality" sub={`Anything of value given to people at public owners: meals, events, travel, gifts. Limits from State rules: ${limitText || "none recorded yet"}; PA Ethics Act and local codes apply too. ${reviewer ? "You see everyone's entries." : "You see your own entries."}`} actions={reviewer && <ExportLinks table="gifts" />} />
      {att ? (
        <details className="panel mb-5" open={!gifts.length}>
          <summary className="cursor-pointer font-semibold">Log a gift or hospitality</summary>
          <div className="mt-3">
            <ActionForm action={logGift} className="form cols-3" submitLabel="Log it">
              <label className="field"><span>Date</span><input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
              <label className="field"><span>Kind</span><select name="kind">{GIFT_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
              <label className="field"><span>Value ($)</span><input name="value" inputMode="decimal" /></label>
              <label className="field"><span>Recipient</span><input name="recipientName" placeholder="name and title" /></label>
              <label className="field"><span>Organization</span><select name="orgId" defaultValue=""><option value="">—</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.state}</option>)}</select></label>
              <label className="field"><span>Jurisdiction (rules that apply)</span><select name="state" defaultValue="PA">{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label className="field full"><span>Description</span><input name="description" placeholder="e.g., lunch after the board meeting" /></label>
              <label className="field"><span>Approved by</span><select name="approverId" defaultValue=""><option value="">Not approved yet</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}</select></label>
            </ActionForm>
          </div>
        </details>
      ) : <p className="banner banner-warn">Sign this year's ethics attestation before logging gifts. <Link href="/training">Go to My learning</Link></p>}
      {gifts.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Recipient</th><th>What</th><th className="num">Value</th><th>Rules</th><th>Given by</th><th>Approved by</th><th>Review</th><th /></tr></thead>
            <tbody>
              {gifts.map((g) => {
                const limit = rules[giftLimitKey(g.state)]?.value ?? null;
                const over = giftOverLimit(Number(g.value), limit);
                return (
                  <tr key={g.id}>
                    <td className="mono text-xs">{fmtDate(g.date)}</td>
                    <td>{g.recipientName}{g.org && <div className="muted text-xs"><Link href={`/organizations/${g.org.id}`}>{g.org.name}</Link></div>}</td>
                    <td className="text-xs">{g.kind}: {g.description}</td>
                    <td className="num">{money(g.value)}</td>
                    <td>{g.state} {over ? <span className="chip chip-bad">⛔ over ${limit}</span> : over === false ? <span className="chip chip-ok">within ${limit}</span> : <span className="text-xs">limit <Confirm /></span>}</td>
                    <td className="text-xs">{g.giver.name ?? g.giver.email}</td>
                    <td className="text-xs">{g.approver ? g.approver.name ?? g.approver.email : <span className="chip chip-warn">⚠ none</span>}</td>
                    <td className="text-xs">
                      {g.reviewedAt ? <>✓ {g.reviewedBy?.name ?? g.reviewedBy?.email}, {fmtDate(g.reviewedAt)}{g.reviewNote && <div className="muted">{g.reviewNote}</div>}</>
                        : reviewer ? <details><summary className="cursor-pointer" style={{ color: "var(--brand)" }}>Review</summary><ActionForm action={reviewGift.bind(null, g.id)} className="flex flex-col gap-1" submitLabel="Mark reviewed"><input name="reviewNote" placeholder="note (optional)" /></ActionForm></details>
                        : <span className="chip">pending</span>}
                    </td>
                    <td>{(reviewer || (g.giverId === user.id && !g.reviewedAt)) && <form action={deleteGift.bind(null, g.id)}><button className="btn btn-sm btn-danger" aria-label="Delete gift">×</button></form>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title="No gifts logged" />}
    </>
  );
}
