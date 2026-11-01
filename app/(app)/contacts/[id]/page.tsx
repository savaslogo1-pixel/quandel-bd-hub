import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty, Fact, Strength } from "@/components/ui";
import { DECISION_ROLE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fmtDate, todayUTC } from "@/lib/format";
import { canEditAccounts, canLogActivity } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { ActivityList } from "../../activities/ActivityList";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const c = await prisma.contact.findUnique({
    where: { id },
    include: { org: true, influences: { select: { id: true, name: true } }, influencedBy: { select: { id: true, name: true } } },
  });
  if (!c) notFound();
  const overdue = c.nextTouch && c.nextTouch < todayUTC();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Contact · <Link href={`/organizations/${c.org.id}`}>{c.org.name}</Link></div>
          <h1 className="text-[28px] font-semibold">{c.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {c.title && <span className="muted">{c.title}</span>}
            {c.decisionRole && <span className="chip chip-brand">{DECISION_ROLE_LABELS[c.decisionRole]}</span>}
            <Strength n={c.relationshipStrength} />
            {c.doNotContact && <span className="chip chip-bad">Do not contact</span>}
            {c.optOut && <span className="chip chip-warn">Opted out of email</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {canLogActivity(user.role) && <Link className="btn btn-primary" href={`/activities/new?org=${c.org.id}&contact=${c.id}`}>Log activity</Link>}
          {canEditAccounts(user.role) && <Link className="btn" href={`/contacts/${c.id}/edit`}>Edit</Link>}
        </div>
      </div>
      <section className="panel facts mb-5">
        <Fact k="Function">{c.function ?? "—"}</Fact>
        <Fact k="Email">{c.email ? <span className="select-all">{c.email}</span> : "—"}</Fact>
        <Fact k="Phone">{c.phone ? <span className="select-all">{c.phone}</span> : "—"}</Fact>
        <Fact k="LinkedIn">{c.linkedinUrl ? <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer">Profile</a> : "—"}</Fact>
        <Fact k="Preferred channel">{c.preferredChannel ?? "—"}</Fact>
        <Fact k="Last touch">{fmtDate(c.lastTouch)}</Fact>
        <Fact k="Next touch">{c.nextTouch ? <span className={`chip ${overdue ? "chip-bad" : ""}`}>{fmtDate(c.nextTouch)}{overdue && " · overdue"}</span> : "—"}</Fact>
        <Fact k="Influences">{c.influences.length ? c.influences.map((i, n) => <span key={i.id}>{n > 0 && ", "}<Link href={`/contacts/${i.id}`}>{i.name}</Link></span>) : "—"}</Fact>
        <Fact k="Influenced by">{c.influencedBy.length ? c.influencedBy.map((i, n) => <span key={i.id}>{n > 0 && ", "}<Link href={`/contacts/${i.id}`}>{i.name}</Link></span>) : "—"}</Fact>
      </section>
      <h2 className="mb-2 text-lg">Activity</h2>
      <ActivityList where={{ contacts: { some: { id: c.id } } }} showOrg={false} empty={<Empty title="No activity with this contact yet" />} />
    </>
  );
}
