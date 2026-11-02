import Link from "next/link";
import { PartChip, ProgressBar } from "@/components/Progress";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { daysFromToday, fmtDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { ATTESTATION_STATEMENT } from "@/lib/training/logic";
import { attestedThisYear, learnerSessions } from "@/lib/training/progress";
import { attest } from "./actions";

export const metadata = { title: "My learning" };

export default async function MyLearning({ searchParams }: { searchParams: Promise<{ ed?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const editions = await prisma.trainingEdition.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { sessions: true } } } });
  const ed = editions.find((e) => e.code === sp.ed) ?? editions[0];
  const [sessions, certs, att, allViews] = await Promise.all([
    ed ? learnerSessions(user.id, ed.id) : Promise.resolve([]),
    prisma.certificate.findMany({ where: { userId: user.id }, include: { edition: true } }),
    attestedThisYear(user.id),
    learnerSessions(user.id),
  ]);
  const year = new Date().getUTCFullYear();
  const assignedOpen = allViews.filter((v) => v.dueDate && !v.parts.complete).sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  return (
    <>
      <PageHeader title="My learning" sub="Course → edition (state) → session. Each session: go through the deck, pass the quiz once it has one, and submit the deliverable when it has one." />
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="panel flex flex-col gap-3">
          {editions.filter((e) => e._count.sessions > 0).map((e) => {
            const v = allViews.filter((x) => x.editionId === e.id);
            return <ProgressBar key={e.id} done={v.filter((x) => x.parts.complete).length} total={v.length} label={`${e.title} edition`} />;
          })}
          {certs.length > 0 && <div className="flex flex-wrap gap-2">{certs.map((c) => <Link key={c.id} className="chip chip-ok" href={`/training/certificates/${c.id}`}>Certificate · {c.edition.title}</Link>)}</div>}
        </section>
        <section className="panel">
          <h2 className="mb-1 text-lg">{year} ethics attestation</h2>
          {att ? (
            <p><span className="chip chip-ok">Signed {fmtDate(att.attestedAt)}</span></p>
          ) : (
            <>
              <p className="mb-2 text-[13px]">{ATTESTATION_STATEMENT}</p>
              <p className="muted mb-2 text-xs">Required each year before you can log gifts or lobbying.</p>
              <form action={attest}><button className="btn btn-primary">I attest</button></form>
            </>
          )}
        </section>
      </div>

      {assignedOpen.length > 0 && (
        <section className="panel mb-5">
          <h2 className="mb-1 text-lg">Assigned to you</h2>
          <ul className="rows">
            {assignedOpen.slice(0, 8).map((v) => {
              const d = daysFromToday(v.dueDate!);
              return (
                <li key={v.id}>
                  <Link href={`/training/sessions/${v.id}`} className="font-semibold">{v.editionCode} Session {v.code}: {v.title}</Link>
                  <span className={`chip ${d < 0 ? "chip-bad" : d <= 7 ? "chip-warn" : ""}`}>{d < 0 ? `${-d} days overdue` : `due ${fmtDate(v.dueDate)}`}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <nav className="filters" aria-label="Edition">
        {editions.map((e) => (
          e._count.sessions ? <Link key={e.id} href={`/training?ed=${e.code}`} className={`btn btn-sm ${e.id === ed?.id ? "btn-primary" : ""}`}>{e.title}</Link>
            : <span key={e.id} className="btn btn-sm" style={{ opacity: 0.45 }} title="Built when this edition exists">{e.title} · planned</span>
        ))}
      </nav>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sessions.map((s) => (
          <Link key={s.id} href={`/training/sessions/${s.id}`} className="panel flex flex-col gap-2 no-underline" style={{ color: "var(--ink)", boxShadow: s.parts.complete ? "inset 3px 0 0 var(--ok)" : undefined }}>
            <div className="flex items-baseline gap-3">
              <span className="font-[family-name:var(--font-display)] text-[26px] font-semibold leading-none" style={{ color: "var(--brand)", minWidth: 40 }}>{s.code}</span>
              <div className="min-w-0"><div className="eyebrow">{s.editionCode} Session {s.code}</div><h2 className="text-[16.5px]">{s.title}</h2></div>
            </div>
            {s.deliverableTitle && <div className="text-xs"><b>Deliverable:</b> {s.deliverableTitle}</div>}
            <div className="mt-auto flex flex-wrap gap-1.5">
              <PartChip label="Deck" state={s.parts.deck} />
              <PartChip label={s.questionCount ? `Quiz${s.bestScore != null ? ` ${s.bestScore}%` : ""}` : "No quiz yet"} state={s.parts.quiz} />
              <PartChip label={s.submissionStatus === "NEEDS_REVISION" ? "Revise" : s.submissionStatus === "SUBMITTED" ? "Submitted" : "Deliverable"} state={s.parts.deliverable} />
              {s.parts.complete && <span className="chip chip-ok">Complete</span>}
              {s.dueDate && !s.parts.complete && <span className="chip chip-warn">due {fmtDate(s.dueDate, { year: false })}</span>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
