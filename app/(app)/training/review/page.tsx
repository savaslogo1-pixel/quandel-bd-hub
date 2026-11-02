import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { canFacilitate } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { CAPSTONE_RUBRIC } from "@/lib/training/logic";
import { reviewSubmission } from "../actions";

export const metadata = { title: "Review deliverables" };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  if (!canFacilitate(user.role)) redirect("/training");
  const show = sp.show === "done" ? "done" : "waiting";
  const subs = await prisma.deliverableSubmission.findMany({
    where: show === "waiting" ? { status: "SUBMITTED" } : { status: { not: "SUBMITTED" } },
    include: { user: { select: { name: true, email: true, companies: { select: { code: true } } } }, session: { include: { edition: true } }, reviewedBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: show === "waiting" ? "asc" : "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader title="Review deliverables" sub="Accept a deliverable to complete that part of the session, or send it back with coaching notes. Capstone plans are scored on the 100-point rubric." />
      <nav className="filters">
        <Link href="/training/review" className={`btn btn-sm ${show === "waiting" ? "btn-primary" : ""}`}>Awaiting review</Link>
        <Link href="/training/review?show=done" className={`btn btn-sm ${show === "done" ? "btn-primary" : ""}`}>Reviewed</Link>
      </nav>
      {subs.length ? (
        <div className="flex flex-col gap-3">
          {subs.map((x) => {
            const cap = x.session.deliverableKind === "CAPSTONE";
            const rs = x.rubricScores ? (JSON.parse(x.rubricScores) as Record<string, number>) : {};
            return (
              <section key={x.id} className="panel">
                <div className="mb-2 flex flex-wrap items-baseline gap-2">
                  <b className="flex-1">{x.user.name ?? x.user.email} · {x.session.edition.code} Session {x.session.code}: {x.session.deliverableTitle}</b>
                  <span className="muted text-xs">submitted {fmtDate(x.createdAt)}{x.user.companies.length ? ` · ${x.user.companies.map((c) => c.code).join(" ")}` : ""}</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-3 text-[13px]">
                  {x.link && <a href={x.link} target="_blank" rel="noopener noreferrer">Open link</a>}
                  {x.fileName && <a href={`/api/training/files/${x.id}`}>Download {x.fileName}</a>}
                  {x.opportunityId && <Link href={`/opportunities/${x.opportunityId}?tab=${x.session.deliverableKind === "APPROVALS" ? "approvals" : "stack"}`}>Open the opportunity</Link>}
                  {x.note && <span className="muted">“{x.note}”</span>}
                </div>
                {show === "done" && (
                  <p className="text-[13px]"><span className={`chip ${x.status === "ACCEPTED" ? "chip-ok" : "chip-bad"}`}>{x.status === "ACCEPTED" ? "Accepted" : "Needs revision"}</span> {x.score != null && <b>{x.score}{cap ? "/100" : ""}</b>} · {x.reviewedBy?.name ?? x.reviewedBy?.email} {fmtDate(x.reviewedAt)}{x.feedback && <span className="block whitespace-pre-wrap">{x.feedback}</span>}</p>
                )}
                {show === "waiting" && (
                  <ActionForm action={reviewSubmission.bind(null, x.id)} className="form cols-3" submitLabel="Save review">
                    <label className="field"><span>Decision</span><select name="status" defaultValue=""><option value="">Choose</option><option value="ACCEPTED">Accept</option><option value="NEEDS_REVISION">Needs revision</option></select></label>
                    {cap ? (
                      <>
                        {CAPSTONE_RUBRIC.criteria.map((c) => <label key={c.key} className="field"><span>{c.label} (0–{c.max})</span><input name={`r_${c.key}`} inputMode="numeric" defaultValue={rs[c.key] ?? ""} /></label>)}
                        <label className="check"><input type="checkbox" name="ethicsViolation" /> Ethics violation (scores 0)</label>
                      </>
                    ) : <label className="field"><span>Score (0–100) <span className="hint">optional</span></span><input name="score" inputMode="numeric" /></label>}
                    <label className="field full"><span>Coaching notes <span className="hint">required when sending back</span></span><textarea name="feedback" /></label>
                  </ActionForm>
                )}
              </section>
            );
          })}
        </div>
      ) : <Empty title={show === "waiting" ? "Nothing waiting" : "No reviews yet"} />}
    </>
  );
}
