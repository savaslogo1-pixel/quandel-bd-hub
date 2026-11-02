import Link from "next/link";
import { Empty } from "@/components/ui";
import { prisma } from "@/lib/db";
import { daysFromToday, fmtDate, todayUTC } from "@/lib/format";
import { canEditAccounts, canLogActivity } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { ActivityList } from "./activities/ActivityList";
import { markNextStepDone } from "./activities/actions";
import { learnerSessions } from "@/lib/training/progress";
import { canFacilitate } from "@/lib/permissions";

export default async function Home() {
  const user = await requireUser();
  const today = todayUTC();
  const [steps, overdue, counts, alerts] = await Promise.all([
    prisma.activity.findMany({
      where: { createdById: user.id, nextStep: { not: null }, nextStepDone: false },
      include: { org: { select: { id: true, name: true } } },
      orderBy: [{ nextStepDate: { sort: "asc", nulls: "last" } }],
      take: 15,
    }),
    prisma.contact.findMany({
      where: { nextTouch: { lt: today }, doNotContact: false, org: { relationshipOwnerId: user.id } },
      include: { org: { select: { id: true, name: true } } },
      orderBy: { nextTouch: "asc" },
      take: 15,
    }),
    Promise.all([
      prisma.organization.count({ where: { relationshipOwnerId: user.id } }),
      prisma.organization.count({ where: { relationshipOwnerId: user.id, tier: "A" } }),
      prisma.activity.count({ where: { createdById: user.id, occurredAt: { gte: new Date(today.getTime() - 30 * 86_400_000) } } }),
      prisma.activity.count({ where: { financingDiscussed: true, financialAdvisorContactId: null } }),
      prisma.opportunity.count({ where: { ownerId: user.id, stage: { lt: 9 } } }),
    ]),
    prisma.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const [owned, tierA, last30, maFlags, myOpps] = counts;
  const training = (await learnerSessions(user.id)).filter((v) => v.dueDate && !v.parts.complete).sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  const toReview = canFacilitate(user.role) ? await prisma.deliverableSubmission.count({ where: { status: "SUBMITTED" } }) : 0;
  const first = (user.name ?? user.email).split(/[ @]/)[0];
  const h = new Date().getHours();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <h1 className="text-[28px] font-semibold">Good {h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"}, {first}</h1>
          <p className="muted">Your next steps and overdue touches across all Quandel companies.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canLogActivity(user.role) && <Link className="btn btn-primary" href="/activities/new">Log activity</Link>}
          {canEditAccounts(user.role) && <Link className="btn" href="/organizations/new">Add organization</Link>}
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat href="/pipeline?mine=1" n={myOpps} label="My open pursuits" />
        <Stat href="/organizations?mine=1" n={owned} label="Organizations I own" />
        <Stat href="/organizations?mine=1&tier=A" n={tierA} label="Tier A I own" />
        <Stat href="/activities?mine=1" n={last30} label="My activities, last 30 days" />
        <Stat href="/activities?financing=unlinked" n={maFlags} label="Financing talks with no FA linked" alert={maFlags > 0} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="panel">
          <h2 className="mb-2 text-lg">My next steps</h2>
          {steps.length ? (
            <ul className="rows">
              {steps.map((s) => {
                const d = s.nextStepDate ? daysFromToday(s.nextStepDate) : null;
                return (
                  <li key={s.id}>
                    <div className="min-w-0 flex-1">
                      <Link href={`/activities/${s.id}`} className="font-semibold">{s.nextStep}</Link>
                      <div className="muted text-xs"><Link href={`/organizations/${s.org.id}`}>{s.org.name}</Link></div>
                    </div>
                    {d != null && <span className={`chip ${d < 0 ? "chip-bad" : d <= 3 ? "chip-warn" : ""}`}>{d < 0 ? `${-d}d overdue` : d === 0 ? "today" : fmtDate(s.nextStepDate, { year: false })}</span>}
                    <form action={markNextStepDone.bind(null, s.id)}><button className="btn btn-sm">Done</button></form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="No open next steps">When you log an activity, add a next step and a date. It shows up here.</Empty>
          )}
        </section>
        <div className="flex min-w-0 flex-col gap-4">
        {alerts.length > 0 && (
          <section className="panel" style={{ borderColor: "var(--gold)" }}>
            <div className="mb-1 flex items-baseline"><h2 className="flex-1 text-lg">Deadline alerts</h2><Link className="text-xs" href="/alerts">All alerts</Link></div>
            <ul className="rows">
              {alerts.map((n) => (
                <li key={n.id}><div className="min-w-0 flex-1">{n.link ? <Link className="font-semibold" href={n.link}>{n.title}</Link> : <b>{n.title}</b>}<div className="muted text-xs">{n.body}</div></div></li>
              ))}
            </ul>
          </section>
        )}
        {(training.length > 0 || toReview > 0) && (
          <section className="panel">
            <div className="mb-1 flex items-baseline"><h2 className="flex-1 text-lg">Training</h2><Link className="text-xs" href="/training">My learning</Link></div>
            {toReview > 0 && <p className="mb-1"><Link href="/training/review">{toReview} deliverable{toReview === 1 ? "" : "s"} waiting for your review</Link></p>}
            <ul className="rows">
              {training.slice(0, 5).map((v) => {
                const d = daysFromToday(v.dueDate!);
                return (
                  <li key={v.id}>
                    <Link href={`/training/sessions/${v.id}`} className="min-w-0 flex-1 font-semibold">{v.editionCode} Session {v.code}: {v.title}</Link>
                    <span className={`chip ${d < 0 ? "chip-bad" : d <= 7 ? "chip-warn" : ""}`}>{d < 0 ? `${-d}d overdue` : `due ${fmtDate(v.dueDate, { year: false })}`}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section className="panel">
          <h2 className="mb-2 text-lg">Overdue touches</h2>
          <p className="muted mb-1 text-xs">Contacts at organizations you own whose next-touch date has passed.</p>
          {overdue.length ? (
            <ul className="rows">
              {overdue.map((c) => (
                <li key={c.id}>
                  <div className="min-w-0 flex-1">
                    <Link href={`/contacts/${c.id}`} className="font-semibold">{c.name}</Link>
                    <div className="muted text-xs">{c.title ? `${c.title} · ` : ""}{c.org.name}</div>
                  </div>
                  <span className="chip chip-bad">{fmtDate(c.nextTouch, { year: false })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">None.</p>
          )}
        </section>
        </div>
      </div>
      <h2 className="mb-2 mt-6 text-lg">Recent activity, all companies</h2>
      <ActivityList where={{}} take={10} empty={<Empty title="No activity yet" />} />
    </>
  );
}

function Stat({ href, n, label, alert }: { href: string; n: number; label: string; alert?: boolean }) {
  return (
    <Link href={href} className="panel no-underline" style={alert ? { borderColor: "var(--bad)", background: "var(--bad-soft)" } : undefined}>
      <b className="block font-[family-name:var(--font-display)] text-[28px] font-semibold leading-tight" style={{ color: alert ? "var(--bad)" : "var(--ink)" }}>{n}</b>
      <span className="muted text-[12.5px]">{label}</span>
    </Link>
  );
}
