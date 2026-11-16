import Link from "next/link";
import type { BidFeedKind, BidFeedPriority, BidFeedStatus, Prisma } from "@prisma/client";
import { CompanyTag, Empty, PageHeader } from "@/components/ui";
import { BidActions } from "./Actions";
import { prisma } from "@/lib/db";
import { KIND_LABELS, PRIORITY_LABELS, STATUS_LABELS, compareBidItems, DUE_SOON_DAYS } from "@/lib/bidFeed/parse";
import { fmtDate, money, todayUTC } from "@/lib/format";
import { canEditOpportunities } from "@/lib/permissions";
import { companies as loadCompanies } from "@/lib/picklists";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Bid feed" };

const KINDS = Object.keys(KIND_LABELS) as BidFeedKind[];
const STATUSES = Object.keys(STATUS_LABELS) as BidFeedStatus[];

type SP = { status?: string; co?: string; type?: string; due?: string; q?: string };

function fmtDue(d: Date): string {
  const date = fmtDate(d);
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  if (hh === 0 && mm === 0) return date;
  return `${date} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function priorityChip(p: BidFeedPriority): string {
  if (p === "HIGH") return "chip chip-bad";
  if (p === "MEDIUM") return "chip chip-warn";
  return "chip";
}

export default async function BidFeedPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const canEdit = canEditOpportunities(user.role);
  const status = sp.status === "all" ? null : STATUSES.includes(sp.status as BidFeedStatus) ? (sp.status as BidFeedStatus) : "NEW";
  const where: Prisma.BidFeedItemWhereInput = {};
  const and: Prisma.BidFeedItemWhereInput[] = [];
  if (status) where.status = status;
  if (sp.type && KINDS.includes(sp.type as BidFeedKind)) where.kind = sp.type as BidFeedKind;
  if (sp.co) and.push({ OR: [{ leadCompany: { code: sp.co } }, { companies: { some: { code: sp.co } } }] });
  if (sp.due === "soon") {
    const end = new Date(todayUTC().getTime() + (DUE_SOON_DAYS + 1) * 86_400_000);
    where.dueAt = { lt: end };
  }
  if (sp.q) {
    const q = { contains: sp.q };
    and.push({ OR: [{ title: q }, { ownerName: q }, { county: q }, { why: q }] });
  }
  if (and.length) where.AND = and;

  const [rows, cos, counts] = await Promise.all([
    prisma.bidFeedItem.findMany({
      where,
      include: {
        companies: { orderBy: { sortOrder: "asc" } },
        leadCompany: true,
        opportunity: { select: { id: true } },
      },
      take: 500,
    }),
    loadCompanies(),
    prisma.bidFeedItem.groupBy({ by: ["status"], _count: true }),
  ]);
  rows.sort(compareBidItems);
  const countOf = (s: BidFeedStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const today = todayUTC().getTime();
  const filtered = Boolean(sp.co || sp.type || sp.due || sp.q || (sp.status && sp.status !== "NEW"));

  return (
    <>
      <PageHeader
        title="Bid feed"
        sub="Pennsylvania solicitations and meeting-minute leads from the daily sweep. Approve opens a stage 1 (Target) opportunity for the matched companies. Dismiss can be restored."
      />
      <p className="muted mb-3 text-xs">
        {STATUSES.map((s, i) => (
          <span key={s}>{i > 0 && " · "}{countOf(s)} {STATUS_LABELS[s].toLowerCase()}</span>
        ))}
        {" · "}due soon means due within {DUE_SOON_DAYS} days, including overdue.
      </p>
      <form className="filters" method="get">
        <input name="q" type="search" placeholder="Search title, owner, county" defaultValue={sp.q ?? ""} />
        <select name="status" defaultValue={status ?? "all"}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select name="co" defaultValue={sp.co ?? ""}>
          <option value="">All companies</option>
          {cos.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
        </select>
        <select name="type" defaultValue={sp.type ?? ""}>
          <option value="">All types</option>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>
        <label className="check"><input type="checkbox" name="due" value="soon" defaultChecked={sp.due === "soon"} /> Due soon</label>
        <button className="btn btn-sm" type="submit">Apply</button>
        {filtered && <Link className="btn btn-sm" href="/bid-feed">Clear</Link>}
      </form>
      {!canEdit && <p className="banner banner-info">You can read the feed. Approving and dismissing are for BD leads, directors, estimators and admins.</p>}

      {rows.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Item</th>
                <th>Owner</th>
                <th>Companies</th>
                <th>Type</th>
                <th>Due</th>
                <th>Value</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const overdue = item.dueAt != null && item.dueAt.getTime() < today && item.status === "NEW";
                const blurb = item.why || item.notes?.split("\n")[0];
                const others = item.companies.filter((c) => c.id !== item.leadCompany?.id);
                const value = item.valueText || (item.estimatedValue != null ? money(item.estimatedValue) : "—");
                return (
                  <tr key={item.id}>
                    <td><span className={priorityChip(item.priority)}>{PRIORITY_LABELS[item.priority]}</span></td>
                    <td>
                      <div className="font-semibold">{item.title}</div>
                      {blurb && <div className="muted mt-0.5 max-w-[42ch] text-xs">{blurb}</div>}
                      <div className="muted mt-0.5 text-[11px]">Seen {fmtDate(item.firstSeenAt)}{item.updatedAt.getTime() - item.firstSeenAt.getTime() > 86_400_000 ? ` · updated ${fmtDate(item.updatedAt)}` : ""}</div>
                    </td>
                    <td>
                      <div>{item.ownerName}</div>
                      <div className="muted text-xs">{[item.county, item.location].filter(Boolean).join(" · ") || item.state}</div>
                    </td>
                    <td>
                      <span className="inline-flex flex-wrap gap-1">
                        {item.leadCompany && <CompanyTag code={item.leadCompany.code} lead />}
                        {others.map((c) => <CompanyTag key={c.id} code={c.code} />)}
                        {!item.leadCompany && !item.companies.length && <span className="muted">—</span>}
                      </span>
                    </td>
                    <td className="text-xs">{item.typeLabel ?? KIND_LABELS[item.kind]}</td>
                    <td className="text-xs whitespace-nowrap">
                      {item.dueAt ? <span className={overdue ? "chip chip-bad" : ""}>{fmtDue(item.dueAt)}</span> : <span className="muted">—</span>}
                      {item.preBidAt && <div className="muted mt-1">Pre-bid {fmtDue(item.preBidAt)}{item.preBidText ? ` · ${item.preBidText}` : ""}</div>}
                      {!item.preBidAt && item.preBidText && <div className="muted mt-1">Pre-bid {item.preBidText}</div>}
                    </td>
                    <td className="max-w-[18ch] text-xs" title={item.valueText ?? undefined}>{value}</td>
                    <td className="text-xs">
                      {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName ?? "Source"}</a> : <span className="muted">{item.sourceName ?? "—"}</span>}
                    </td>
                    <td>
                      {status == null && <div className="mb-1 text-right"><span className="chip">{STATUS_LABELS[item.status]}</span></div>}
                      {item.opportunity ? (
                        <Link className="btn btn-sm" href={`/opportunities/${item.opportunity.id}`}>Opportunity</Link>
                      ) : canEdit && item.status !== "APPROVED" ? (
                        <BidActions id={item.id} status={item.status} />
                      ) : (
                        <span className="chip">{STATUS_LABELS[item.status]}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={filtered || status !== "NEW" ? "No items match these filters" : "No new items"}>
          {status === "NEW" && !filtered ? "The daily sweep posts here. Approved items become stage 1 opportunities." : "Try another status or clear the filters."}
        </Empty>
      )}
      {rows.length === 500 && <p className="muted mt-2 text-xs">Showing the first 500. Narrow the filters to see more.</p>}
    </>
  );
}
