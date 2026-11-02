import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { canFacilitate } from "@/lib/permissions";
import { companies as loadCompanies } from "@/lib/picklists";
import { requireUser } from "@/lib/session";
import { createAssignment, deleteAssignment } from "../actions";

export const metadata = { title: "Assign training" };

export default async function AssignPage() {
  const user = await requireUser();
  if (!canFacilitate(user.role)) redirect("/training");
  const [editions, users, cos, list] = await Promise.all([
    prisma.trainingEdition.findMany({ where: { sessions: { some: {} } }, include: { sessions: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    loadCompanies(),
    prisma.trainingAssignment.findMany({ include: { session: { include: { edition: true } }, edition: true, user: true, company: true }, orderBy: [{ dueDate: "asc" }] }),
  ]);
  return (
    <>
      <PageHeader title="Assign training" sub="Assign a whole edition or one session to a person, or to everyone tagged with a company. Learners see due dates on My learning and Home." />
      <section className="panel mb-5">
        <ActionForm action={createAssignment} className="form cols-3" submitLabel="Assign">
          <label className="field"><span>Training</span>
            <select name="target" defaultValue="">
              <option value="">Choose…</option>
              {editions.map((e) => (
                <optgroup key={e.id} label={e.title}>
                  <option value={`e:${e.id}`}>Whole {e.title} edition</option>
                  {e.sessions.map((s) => <option key={s.id} value={`s:${s.id}`}>Session {s.code}: {s.title}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="field"><span>Assign to</span>
            <select name="who" defaultValue="">
              <option value="">Choose…</option>
              <optgroup label="Company (everyone tagged)">{cos.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.code} · {c.name}</option>)}</optgroup>
              <optgroup label="Person">{users.map((u) => <option key={u.id} value={`u:${u.id}`}>{u.name ?? u.email}</option>)}</optgroup>
            </select>
          </label>
          <label className="field"><span>Due</span><input type="date" name="dueDate" /></label>
          <label className="field full"><span>Note</span><input name="note" /></label>
        </ActionForm>
      </section>
      {list.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Training</th><th>Assigned to</th><th>Due</th><th>Note</th><th /></tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>{a.session ? `${a.session.edition.code} Session ${a.session.code}: ${a.session.title}` : `${a.edition?.title} edition`}</td>
                  <td>{a.user ? a.user.name ?? a.user.email : a.company ? <><span className={`co co-${a.company.code}`}>{a.company.code}</span> everyone</> : "—"}</td>
                  <td className="mono text-xs">{fmtDate(a.dueDate)}</td>
                  <td className="text-xs">{a.note}</td>
                  <td><form action={deleteAssignment.bind(null, a.id)}><button className="btn btn-sm btn-danger">Remove</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="Nothing assigned yet" />}
    </>
  );
}
