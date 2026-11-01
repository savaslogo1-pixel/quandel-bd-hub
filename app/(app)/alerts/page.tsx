import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { markAllRead, markRead } from "./actions";

export const metadata = { title: "Alerts" };

export default async function AlertsPage() {
  const user = await requireUser();
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }], take: 200 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader
        title="Alerts"
        sub="Program deadlines at 90, 60, 30 and 14 days, for opportunities you own whose capital stack uses that program (rows not yet awarded, denied or closed)."
        actions={unread > 0 && <form action={markAllRead}><button className="btn">Mark all read</button></form>}
      />
      {items.length ? (
        <ul className="rows panel">
          {items.map((n) => (
            <li key={n.id} style={n.readAt ? { opacity: 0.6 } : undefined}>
              <div className="min-w-0 flex-1">
                {n.link ? <Link className="font-semibold" href={n.link}>{n.title}</Link> : <b>{n.title}</b>}
                {n.body && <div className="muted text-[13px]">{n.body}</div>}
              </div>
              <span className="muted text-xs">{fmtDate(n.createdAt)}</span>
              {!n.readAt && <form action={markRead.bind(null, n.id)}><button className="btn btn-sm">Mark read</button></form>}
            </li>
          ))}
        </ul>
      ) : <Empty title="No alerts">Alerts appear when a program on one of your capital stacks has a deadline within 90 days.</Empty>}
      <p className="muted mt-3 text-xs">Email delivery isn't set up yet; alerts show here and on Home. [confirm] how Quandel wants them emailed (Microsoft 365).</p>
    </>
  );
}
