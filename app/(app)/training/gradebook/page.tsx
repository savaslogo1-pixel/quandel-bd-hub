import Link from "next/link";
import { redirect } from "next/navigation";
import { CompanyTags, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canFacilitate, ROLE_LABELS } from "@/lib/permissions";
import { companies as loadCompanies } from "@/lib/picklists";
import { requireUser } from "@/lib/session";
import { learnerSessions } from "@/lib/training/progress";

export const metadata = { title: "Gradebook" };

export default async function Gradebook({ searchParams }: { searchParams: Promise<{ co?: string; ed?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  if (!canFacilitate(user.role)) redirect("/training");
  const [editions, cos] = await Promise.all([prisma.trainingEdition.findMany({ where: { sessions: { some: {} } }, orderBy: { sortOrder: "asc" } }), loadCompanies()]);
  const ed = editions.find((e) => e.code === sp.ed) ?? editions[0];
  const people = await prisma.user.findMany({ where: { active: true, ...(sp.co ? { companies: { some: { code: sp.co } } } : {}) }, include: { companies: true, attestations: { where: { year: new Date().getUTCFullYear() } }, certificates: true }, orderBy: { name: "asc" } });
  const rows = await Promise.all(people.map(async (p) => ({ p, v: await learnerSessions(p.id, ed?.id) })));
  const sessions = rows[0]?.v ?? (ed ? await learnerSessions(user.id, ed.id) : []);
  const byCo = cos.map((c) => {
    const rs = rows.filter((r) => r.p.companies.some((x) => x.id === c.id));
    const done = rs.reduce((a, r) => a + r.v.filter((x) => x.parts.complete).length, 0);
    const total = rs.length * sessions.length;
    return { c, people: rs.length, pct: total ? Math.round((done / total) * 100) : null };
  });
  const quizAvg = (() => {
    const s = rows.flatMap((r) => r.v.map((x) => x.bestScore).filter((x): x is number => x != null));
    return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
  })();
  return (
    <>
      <PageHeader title="Gradebook" sub="Completion, quiz scores and deliverables by person. A cell shows the session's state: ✓ complete, the best quiz score, or what's still open." />
      <form className="filters" method="get">
        <select name="ed" defaultValue={ed?.code}>{editions.map((e) => <option key={e.id} value={e.code}>{e.title}</option>)}</select>
        <select name="co" defaultValue={sp.co ?? ""}><option value="">All companies</option>{cos.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select>
        <button className="btn btn-sm">Apply</button>
        <span className="muted text-sm">Quiz average: {quizAvg != null ? `${quizAvg}%` : "—"}</span>
      </form>
      <section className="mb-4 flex flex-wrap gap-2">
        {byCo.filter((b) => b.people).map((b) => <span key={b.c.code} className="chip"><span className={`co co-${b.c.code}`}>{b.c.code}</span> {b.people} people · {b.pct}% complete</span>)}
      </section>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Person</th>{sessions.map((s) => <th key={s.id} className="num" title={s.title}><Link href={`/training/sessions/${s.id}`}>{s.code}</Link></th>)}<th className="num">Done</th><th>Ethics</th><th>Certificate</th></tr>
          </thead>
          <tbody>
            {rows.map(({ p, v }) => (
              <tr key={p.id}>
                <td><b>{p.name ?? p.email}</b><div className="muted text-xs">{ROLE_LABELS[p.role]} <CompanyTags codes={p.companies} /></div></td>
                {v.map((x) => (
                  <td key={x.id} className="num text-xs" title={`Deck ${x.parts.deck} · quiz ${x.parts.quiz} · deliverable ${x.parts.deliverable}`}>
                    {x.parts.complete ? <span style={{ color: "var(--ok)" }}>✓</span>
                      : x.submissionStatus === "SUBMITTED" ? <span className="chip chip-warn">rev</span>
                      : x.bestScore != null ? `${x.bestScore}%`
                      : x.parts.deck === "done" ? "·" : ""}
                  </td>
                ))}
                <td className="num">{v.filter((x) => x.parts.complete).length}/{v.length}</td>
                <td>{p.attestations.length ? <span className="chip chip-ok">✓</span> : <span className="chip">—</span>}</td>
                <td>{p.certificates.some((c) => c.editionId === ed?.id) ? <span className="chip chip-ok">{ed?.code}</span> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
