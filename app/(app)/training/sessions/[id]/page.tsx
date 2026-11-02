import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { PartChip } from "@/components/Progress";

import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { canFacilitate } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { CAPSTONE_RUBRIC } from "@/lib/training/logic";
import { learnerSessions } from "@/lib/training/progress";
import { addModule, deleteModule, markDeckReviewed, submitDeliverable, updateSession } from "../../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.trainingSession.findUnique({ where: { id }, select: { title: true, code: true } });
  return { title: s ? `Session ${s.code}: ${s.title}` : "Session" };
}

const KIND_HELP = {
  LINK: "Attach the file or paste a link to it.",
  CAPITAL_STACK: "Build it with the capital-stack tool on a practice opportunity (Opportunity → Capital stack), then pick that opportunity here.",
  APPROVALS: "Build it with the approvals tool on a practice opportunity (Opportunity → Approvals), then pick that opportunity here.",
  CAPSTONE: `Scored on the 100-point rubric: ${CAPSTONE_RUBRIC.criteria.map((c) => `${c.label.toLowerCase()} ${c.max}`).join(", ")}. Any ethics violation scores 0.`,
} as const;

export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const s = await prisma.trainingSession.findUnique({
    where: { id },
    include: { edition: true, modules: { orderBy: { sortOrder: "asc" } }, _count: { select: { questions: { where: { active: true } } } } },
  });
  if (!s) notFound();
  const [view] = (await learnerSessions(user.id, s.editionId)).filter((v) => v.id === id);
  const [subs, opps] = await Promise.all([
    prisma.deliverableSubmission.findMany({ where: { sessionId: id, userId: user.id }, orderBy: { createdAt: "desc" }, include: { reviewedBy: { select: { name: true, email: true } } } }),
    s.deliverableKind && s.deliverableKind !== "LINK"
      ? prisma.opportunity.findMany({ where: { OR: [{ ownerId: user.id }, { createdById: user.id }] }, select: { id: true, name: true, org: { select: { name: true } } }, orderBy: { updatedAt: "desc" } })
      : Promise.resolve([]),
  ]);
  const fac = canFacilitate(user.role);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="eyebrow"><Link href={`/training?ed=${s.edition.code}`}>{s.edition.title} edition</Link> · Session {s.code}</div>
          <h1 className="text-[28px] font-semibold">{s.title}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <PartChip label="Deck" state={view.parts.deck} />
            <PartChip label={s._count.questions ? "Quiz" : "No quiz yet"} state={view.parts.quiz} />
            <PartChip label="Deliverable" state={view.parts.deliverable} />
            {view.parts.complete && <span className="chip chip-ok">Session complete {view.completedAt && `· ${fmtDate(view.completedAt)}`}</span>}
          </div>
        </div>
      </div>
      {sp.submitted && <p className="banner banner-info">Submitted. A facilitator will review it; you'll see the result here.</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="panel">
            <h2 className="mb-1 text-lg">1. The deck</h2>
            <div className="flex flex-wrap items-center gap-2">
              {s.deckUrl ? <a className="btn btn-primary" href={s.deckUrl} target="_blank" rel="noopener noreferrer">Open the deck</a> : <span className="muted">No deck link yet.</span>}
              {s.notesUrl && <a className="btn" href={s.notesUrl} target="_blank" rel="noopener noreferrer">Speaker notes</a>}
              {s.glossaryUrl && <a className="btn" href={s.glossaryUrl} target="_blank" rel="noopener noreferrer">Glossary</a>}
              {view.parts.deck === "done" ? <span className="chip chip-ok">Gone through</span> : <form action={markDeckReviewed.bind(null, id)}><button className="btn">I've gone through the deck</button></form>}
            </div>
            {s.modules.length > 0 && (
              <ul className="rows mt-3">
                {s.modules.map((m) => (
                  <li key={m.id}>
                    <span>{m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer">{m.title}</a> : m.title}</span>
                    {fac && <form action={deleteModule.bind(null, m.id)}><button className="btn btn-sm btn-danger" aria-label={`Remove module ${m.title}`}>Remove</button></form>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2 className="mb-1 text-lg">2. Quiz</h2>
            {s._count.questions ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>{s._count.questions} questions · pass at {s.passPct}% · retakes allowed.</span>
                {view.bestScore != null && <span className={`chip ${view.parts.quiz === "done" ? "chip-ok" : "chip-warn"}`}>Best {view.bestScore}% · {view.attempts} attempt{view.attempts === 1 ? "" : "s"}</span>}
                <Link className="btn btn-primary" href={`/training/sessions/${id}/quiz`}>{view.attempts ? "Retake the quiz" : "Take the quiz"}</Link>
              </div>
            ) : <p className="muted mb-0">No quiz for this session yet. It doesn't block completion until a facilitator adds one.</p>}
            {fac && <Link className="mt-2 inline-block text-sm" href={`/training/sessions/${id}/questions`}>Write or edit quiz questions →</Link>}
          </section>

          {s.applyIt && (
            <section className="panel" style={{ borderColor: "var(--gold)" }}>
              <h2 className="mb-1 text-lg">Apply it</h2>
              <p className="mb-2">{s.applyIt}</p>
              {s.applyItHref && <Link className="btn" href={s.applyItHref}>Do it in the CRM</Link>}
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="panel">
            <h2 className="mb-1 text-lg">3. Deliverable</h2>
            {s.deliverableTitle ? (
              <>
                <p className="mb-1 font-semibold">{s.deliverableTitle}</p>
                <p className="muted mb-2 text-xs">{KIND_HELP[s.deliverableKind ?? "LINK"]}</p>
                {s.templateUrl && <a className="btn btn-sm mb-2" href={s.templateUrl} target="_blank" rel="noopener noreferrer">Template</a>}
                {subs.length > 0 && (
                  <ul className="rows mb-3">
                    {subs.map((x) => (
                      <li key={x.id}>
                        <div className="min-w-0 flex-1 text-[13px]">
                          <span className={`chip ${x.status === "ACCEPTED" ? "chip-ok" : x.status === "NEEDS_REVISION" ? "chip-bad" : "chip-warn"}`}>{x.status === "ACCEPTED" ? "Accepted" : x.status === "NEEDS_REVISION" ? "Needs revision" : "Awaiting review"}</span>
                          {x.score != null && <b className="ml-1">{x.score}{s.deliverableKind === "CAPSTONE" ? "/100" : ""}</b>}
                          <div className="muted text-xs">Submitted {fmtDate(x.createdAt)}{x.reviewedAt && ` · reviewed ${fmtDate(x.reviewedAt)} by ${x.reviewedBy?.name ?? x.reviewedBy?.email}`}</div>
                          {x.link && <div><a href={x.link} target="_blank" rel="noopener noreferrer">Link</a></div>}
                          {x.fileName && <div><a href={`/api/training/files/${x.id}`}>{x.fileName}</a></div>}
                          {x.opportunityId && <div><Link href={`/opportunities/${x.opportunityId}`}>Opportunity</Link></div>}
                          {x.feedback && <div className="mt-1 whitespace-pre-wrap"><b>Coaching notes:</b> {x.feedback}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {view.parts.deliverable !== "done" && (
                  <ActionForm action={submitDeliverable.bind(null, id)} className="form" submitLabel={subs.length ? "Resubmit" : "Submit"}>
                    {s.deliverableKind !== "LINK" && (
                      <label className="field full"><span>Opportunity you built it on</span>
                        <select name="opportunityId" defaultValue=""><option value="">—</option>{opps.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.org.name}</option>)}</select>
                      </label>
                    )}
                    <label className="field full"><span>File <span className="hint">up to 10 MB</span></span><input id="deliverable-file" type="file" name="file" /></label>
                    <label className="field full"><span>Or a link</span><input name="link" type="url" placeholder="https://" /></label>
                    <label className="field full"><span>Note to the facilitator</span><textarea name="note" /></label>
                  </ActionForm>
                )}
              </>
            ) : <p className="muted mb-0">This session has no deliverable.</p>}
          </section>

          {fac && (
            <details className="panel">
              <summary className="cursor-pointer font-semibold">Facilitator: edit this session</summary>
              <div className="mt-3">
                <ActionForm action={updateSession.bind(null, id)} className="form" submitLabel="Save session">
                  <label className="field full"><span>Title</span><input name="title" defaultValue={s.title} /></label>
                  <label className="field full"><span>Deck link</span><input name="deckUrl" defaultValue={s.deckUrl ?? ""} /></label>
                  <label className="field full"><span>Speaker notes link</span><input name="notesUrl" defaultValue={s.notesUrl ?? ""} /></label>
                  <label className="field full"><span>Glossary link</span><input name="glossaryUrl" defaultValue={s.glossaryUrl ?? ""} /></label>
                  <label className="field full"><span>Deliverable</span><input name="deliverableTitle" defaultValue={s.deliverableTitle ?? ""} placeholder="blank = no deliverable" /></label>
                  <label className="field"><span>Built with</span><select name="deliverableKind" defaultValue={s.deliverableKind ?? "LINK"}><option value="LINK">File or link</option><option value="CAPITAL_STACK">Capital-stack tool</option><option value="APPROVALS">Approvals tool</option><option value="CAPSTONE">Capstone rubric</option></select></label>
                  <label className="field"><span>Quiz pass mark (%)</span><input name="passPct" inputMode="numeric" defaultValue={s.passPct} /></label>
                  <label className="field full"><span>Deliverable template link</span><input name="templateUrl" defaultValue={s.templateUrl ?? ""} /></label>
                  <label className="field full"><span>Apply it (task in the live CRM)</span><input name="applyIt" defaultValue={s.applyIt ?? ""} /></label>
                  <label className="field full"><span>Apply it link <span className="hint">a CRM page, e.g. /pipeline</span></span><input name="applyItHref" defaultValue={s.applyItHref ?? ""} /></label>
                </ActionForm>
                <h3 className="mb-1 mt-4 text-base">Add a module</h3>
                <ActionForm action={addModule.bind(null, id)} className="form" submitLabel="Add module">
                  <label className="field full"><span>Title</span><input name="title" /></label>
                  <label className="field full"><span>Link</span><input name="url" placeholder="https://" /></label>
                </ActionForm>
              </div>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
