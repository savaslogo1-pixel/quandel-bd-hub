import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { submitQuiz } from "../../../actions";

export const metadata = { title: "Quiz" };

export default async function QuizPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ attempt?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const s = await prisma.trainingSession.findUnique({ where: { id }, include: { edition: true, questions: { where: { active: true }, orderBy: { sortOrder: "asc" } } } });
  if (!s) notFound();
  const head = (
    <div className="mb-4">
      <div className="eyebrow"><Link href={`/training/sessions/${id}`}>{s.edition.title} · Session {s.code}: {s.title}</Link></div>
      <h1 className="text-[26px] font-semibold">Quiz</h1>
      <p className="muted">{s.questions.length} questions · pass at {s.passPct}% · retakes allowed</p>
    </div>
  );
  if (!s.questions.length) return <>{head}<p className="banner banner-info">No quiz for this session yet.</p></>;

  const attempt = sp.attempt ? await prisma.quizAttempt.findFirst({ where: { id: sp.attempt, userId: user.id, sessionId: id } }) : null;
  if (attempt) {
    const answers = JSON.parse(attempt.answers) as Record<string, number>;
    return (
      <>
        {head}
        <div className={`banner ${attempt.passed ? "banner-info" : "banner-bad"}`} role="status">
          <b className="text-lg">{attempt.passed ? "Passed" : "Not passed yet"}: {attempt.scorePct}%</b> ({attempt.correct} of {attempt.total} right).{" "}
          {!attempt.passed && `You need ${s.passPct}%. Review the deck and try again.`}
        </div>
        <ol className="flex flex-col gap-3">
          {s.questions.map((q, n) => {
            const opts = JSON.parse(q.options) as string[];
            const chose = answers[q.id];
            const right = chose === q.correctIndex;
            return (
              <li key={q.id} className="panel" style={{ boxShadow: `inset 3px 0 0 var(--${right ? "ok" : "bad"})` }}>
                <b>{n + 1}. {q.prompt}</b>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {opts.map((o, i) => (
                    <li key={i} style={{ color: i === q.correctIndex ? "var(--ok)" : i === chose ? "var(--bad)" : undefined }}>
                      {i === q.correctIndex ? "✓" : i === chose ? "✗" : "·"} {o}{i === chose && " (your answer)"}
                    </li>
                  ))}
                </ul>
                {q.explanation && <p className="muted mt-1 text-[13px]">{q.explanation}</p>}
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex gap-2">
          <Link className="btn" href={`/training/sessions/${id}`}>Back to the session</Link>
          {!attempt.passed && <Link className="btn btn-primary" href={`/training/sessions/${id}/quiz`}>Retake</Link>}
        </div>
      </>
    );
  }

  return (
    <>
      {head}
      <ActionForm action={submitQuiz.bind(null, id)} className="flex flex-col gap-3" submitLabel="Submit answers">
        {s.questions.map((q, n) => {
          const opts = JSON.parse(q.options) as string[];
          return (
            <fieldset key={q.id} className="panel">
              <legend className="sr-only">Question {n + 1}</legend>
              <b>{n + 1}. {q.prompt}</b>
              <div className="mt-2 flex flex-col gap-1.5">
                {opts.map((o, i) => (
                  <label key={i} className="check"><input type="radio" name={`q_${q.id}`} value={i} /> {o}</label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </ActionForm>
    </>
  );
}
