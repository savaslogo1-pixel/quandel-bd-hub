import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { prisma } from "@/lib/db";
import { canFacilitate } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { addQuestion, deleteQuestion, toggleQuestion, updateQuestion } from "../../../actions";

export const metadata = { title: "Quiz questions" };

function Fields({ q }: { q?: { prompt: string; options: string[]; correctIndex: number; explanation: string | null } }) {
  return (
    <>
      <label className="field full"><span>Question</span><textarea name="prompt" defaultValue={q?.prompt ?? ""} /></label>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <label key={i} className="field"><span>Answer {i}{i > 2 && <span className="hint"> optional</span>}</span><input name={`option${i}`} defaultValue={q?.options[i - 1] ?? ""} /></label>
      ))}
      <label className="field"><span>Correct answer</span>
        <select name="correct" defaultValue={q ? String(q.correctIndex + 1) : ""}><option value="">Choose</option>{[1, 2, 3, 4, 5, 6].map((i) => <option key={i} value={i}>Answer {i}</option>)}</select>
      </label>
      <label className="field full"><span>Explanation <span className="hint">shown after the learner answers</span></span><textarea name="explanation" defaultValue={q?.explanation ?? ""} /></label>
    </>
  );
}

export default async function QuestionsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  if (!canFacilitate(user.role)) redirect(`/training/sessions/${id}`);
  const s = await prisma.trainingSession.findUnique({ where: { id }, include: { edition: true, questions: { orderBy: { sortOrder: "asc" } } } });
  if (!s) notFound();
  const active = s.questions.filter((q) => q.active).length;
  return (
    <>
      <div className="mb-4">
        <div className="eyebrow"><Link href={`/training/sessions/${id}`}>{s.edition.title} · Session {s.code}: {s.title}</Link></div>
        <h1 className="text-[26px] font-semibold">Quiz questions</h1>
        <p className="muted">The spec calls for 5 to 10 questions per session, auto-graded, {s.passPct}% to pass. Write them from the session's deck; learners see the explanation after they answer.</p>
      </div>
      {sp.added && <p className="banner banner-info">Question added.</p>}
      <p className={`banner ${active >= 5 && active <= 10 ? "banner-info" : "banner-warn"}`}>{active} active question{active === 1 ? "" : "s"}{active < 5 ? ": add at least 5." : active > 10 ? ": the spec suggests at most 10." : "."}</p>
      <ol className="mb-5 flex flex-col gap-3">
        {s.questions.map((q, n) => {
          const opts = JSON.parse(q.options) as string[];
          return (
            <li key={q.id} className="panel" style={q.active ? undefined : { opacity: 0.6 }}>
              <div className="flex flex-wrap items-start gap-2">
                <b className="min-w-0 flex-1">{n + 1}. {q.prompt}</b>
                {!q.active && <span className="chip">off</span>}
                <form action={toggleQuestion.bind(null, q.id)}><button className="btn btn-sm">{q.active ? "Turn off" : "Turn on"}</button></form>
              </div>
              <ul className="mt-1 text-[13px]">{opts.map((o, i) => <li key={i} style={i === q.correctIndex ? { color: "var(--ok)", fontWeight: 600 } : undefined}>{i === q.correctIndex ? "✓" : "·"} {o}</li>)}</ul>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs" style={{ color: "var(--brand)" }}>Edit</summary>
                <div className="mt-2"><ActionForm action={updateQuestion.bind(null, q.id)} className="form cols-3" submitLabel="Save question"><Fields q={{ ...q, options: opts }} /></ActionForm></div>
                <form action={deleteQuestion.bind(null, q.id)} className="mt-2"><ConfirmButton label="Delete question" confirmLabel="Click again to delete" /></form>
              </details>
            </li>
          );
        })}
      </ol>
      <section className="panel">
        <h2 className="mb-2 text-lg">Add a question</h2>
        <ActionForm key={s.questions.length} action={addQuestion.bind(null, id)} className="form cols-3" submitLabel="Add question"><Fields /></ActionForm>
      </section>
    </>
  );
}
