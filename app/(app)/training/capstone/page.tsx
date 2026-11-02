import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Timer } from "@/components/Timer";
import { Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { canFacilitate } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { CAPSTONE_RUBRIC, MOCK_BOARD_ROLES } from "@/lib/training/logic";
import { addTeam, createCapstone, deleteTeam, scoreTeam } from "../actions";

export const metadata = { title: "Capstone" };

export default async function CapstonePage() {
  const user = await requireUser();
  if (!canFacilitate(user.role)) redirect("/training");
  const [events, editions, users, opps] = await Promise.all([
    prisma.capstoneEvent.findMany({ include: { edition: true, teams: { orderBy: { createdAt: "asc" } } }, orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }] }),
    prisma.trainingEdition.findMany({ where: { sessions: { some: {} } }, orderBy: { sortOrder: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.opportunity.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const name = (id: string) => { const u = users.find((x) => x.id === id); return u ? u.name ?? u.email : "—"; };
  return (
    <>
      <PageHeader title="Capstone: pitch to a mock board" sub={`Teams present a plan to a mock board (${MOCK_BOARD_ROLES.join(", ")}). Scored on the 100-point rubric: ${CAPSTONE_RUBRIC.criteria.map((c) => `${c.label.toLowerCase()} ${c.max}`).join(", ")}. Any ethics violation scores the plan 0.`} />
      <details className="panel mb-5">
        <summary className="cursor-pointer font-semibold">Schedule a capstone</summary>
        <div className="mt-3">
          <ActionForm action={createCapstone} className="form cols-3" submitLabel="Create">
            <label className="field"><span>Edition</span><select name="editionId">{editions.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
            <label className="field"><span>Title</span><input name="title" placeholder="e.g., Spring cohort capstone" /></label>
            <label className="field"><span>Date</span><input type="date" name="scheduledAt" /></label>
            <label className="field"><span>Minutes per team</span><input name="minutesPerTeam" inputMode="numeric" placeholder="e.g., 20" /></label>
            <label className="field full"><span>Notes</span><textarea name="notes" /></label>
          </ActionForm>
        </div>
      </details>
      {events.length ? events.map((e) => (
        <section key={e.id} className="mb-6">
          <div className="mb-2 flex flex-wrap items-baseline gap-3">
            <h2 className="flex-1 text-xl">{e.title} <span className="muted text-sm">· {e.edition.title} · {fmtDate(e.scheduledAt)}</span></h2>
            {e.minutesPerTeam && <Timer minutes={e.minutesPerTeam} />}
          </div>
          {e.notes && <p className="muted mb-2">{e.notes}</p>}
          <div className="grid gap-3 lg:grid-cols-2">
            {e.teams.map((t) => {
              const members = JSON.parse(t.memberIds) as string[];
              const roles = t.boardRoles ? (JSON.parse(t.boardRoles) as Record<string, string>) : {};
              const rs = t.rubricScores ? (JSON.parse(t.rubricScores) as Record<string, number>) : {};
              return (
                <div key={t.id} className="panel">
                  <div className="mb-1 flex items-baseline gap-2">
                    <b className="flex-1 text-base">{t.name}</b>
                    {t.total != null && <span className={`chip ${t.ethicsViolation ? "chip-bad" : "chip-ok"}`}>{t.total}/100{t.ethicsViolation ? " · ethics violation" : ""}</span>}
                  </div>
                  <p className="text-[13px]">Team: {members.map(name).join(", ") || "—"}{t.opportunityId && <> · <Link href={`/opportunities/${t.opportunityId}`}>their opportunity</Link></>}</p>
                  {Object.keys(roles).length > 0 && <p className="muted text-xs">Board: {Object.entries(roles).map(([r, w]) => `${r}: ${name(w) !== "—" ? name(w) : w}`).join(" · ")}</p>}
                  <details className="mt-2" open={t.total == null}>
                    <summary className="cursor-pointer text-sm" style={{ color: "var(--brand)" }}>{t.total == null ? "Score this team" : "Edit scores"}</summary>
                    <div className="mt-2">
                      <ActionForm action={scoreTeam.bind(null, t.id)} className="form" submitLabel="Save scores">
                        {CAPSTONE_RUBRIC.criteria.map((c) => <label key={c.key} className="field"><span>{c.label} (0–{c.max})</span><input name={`r_${c.key}`} inputMode="numeric" defaultValue={rs[c.key] ?? ""} /></label>)}
                        <label className="check full"><input type="checkbox" name="ethicsViolation" defaultChecked={t.ethicsViolation} /> Ethics violation (the plan scores 0)</label>
                        <label className="field full"><span>Board feedback</span><textarea name="feedback" defaultValue={t.feedback ?? ""} /></label>
                      </ActionForm>
                      <form action={deleteTeam.bind(null, t.id)} className="mt-2"><ConfirmButton label="Remove team" confirmLabel="Click again to remove" /></form>
                    </div>
                  </details>
                </div>
              );
            })}
            <details className="panel">
              <summary className="cursor-pointer font-semibold">Add a team</summary>
              <div className="mt-2">
                <ActionForm action={addTeam.bind(null, e.id)} className="form" submitLabel="Add team">
                  <label className="field full"><span>Team name</span><input name="name" /></label>
                  <fieldset className="field full"><legend>Members</legend><div className="checks">{users.map((u) => <label key={u.id}><input type="checkbox" name="members" value={u.id} /> {u.name ?? u.email}</label>)}</div></fieldset>
                  <label className="field full"><span>Opportunity the plan is about</span><select name="opportunityId" defaultValue=""><option value="">—</option>{opps.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                  {MOCK_BOARD_ROLES.map((r) => (
                    <label key={r} className="field"><span>{r}</span><input type="hidden" name="roleName" value={r} /><select name="roleWho" defaultValue=""><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}</select></label>
                  ))}
                </ActionForm>
              </div>
            </details>
          </div>
        </section>
      )) : <Empty title="No capstones scheduled" />}
    </>
  );
}
