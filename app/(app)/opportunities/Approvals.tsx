import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Empty } from "@/components/ui";
import { APPROVAL_TEMPLATES, DOCUMENT_LABELS } from "@/lib/approvals";
import { prisma } from "@/lib/db";
import { daysFromToday, fmtDate, todayUTC, ymd } from "@/lib/format";
import { parsePattern, patternText } from "@/lib/meetings";
import { loadRules } from "@/lib/rules";
import { addStep, deleteStep, loadTemplate, moveStep, runScheduler, setStepStatus, updateStep } from "./approvalActions";
import { SchedulerForm } from "./SchedulerForm";

const STATUS_LABEL = { PLANNED: "Planned", SCHEDULED: "Scheduled", DONE: "Done" } as const;

export async function Approvals({ oppId, canEdit }: { oppId: string; canEdit: boolean }) {
  const [opp, rules] = await Promise.all([
    prisma.opportunity.findUniqueOrThrow({
      where: { id: oppId },
      include: { org: true, approvalSteps: { include: { ownerContact: { select: { id: true, name: true } } }, orderBy: { sortOrder: "asc" } } },
    }),
    loadRules(),
  ]);
  const contacts = await prisma.contact.findMany({ where: { orgId: opp.orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const org = opp.org;
  const pText = patternText(parsePattern(org.meetingWeekday, org.meetingWeeksOfMonth));
  const steps = opp.approvalSteps;
  const today = todayUTC();
  const template = APPROVAL_TEMPLATES[org.state];
  const deadlineMissed = opp.approvalsDeadline && steps.some((s) => s.meetingDate && s.meetingDate > opp.approvalsDeadline!);

  const stepFields = (s?: (typeof steps)[number]) => (
    <>
      <label className="field full"><span>Step</span><input name="label" defaultValue={s?.label ?? ""} /></label>
      <label className="field"><span>Body</span><input name="body" defaultValue={s?.body ?? ""} placeholder="e.g., Governing body" /></label>
      <label className="field"><span>Document</span><select name="document" defaultValue={s?.document ?? "OTHER"}>{Object.entries(DOCUMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="field"><span>Date</span><input type="date" name="meetingDate" defaultValue={ymd(s?.meetingDate)} /></label>
      <label className="field"><span>Status</span><select name="status" defaultValue={s?.status ?? "PLANNED"}>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="field"><span>Owner contact</span><select name="ownerContactId" defaultValue={s?.ownerContactId ?? ""}><option value="">—</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="field"><span>Wait after (days) <span className="hint">if no rule</span></span><input name="waitAfterDays" inputMode="numeric" defaultValue={s?.waitAfterDays ?? ""} /></label>
      <label className="field"><span>Wait from rule <span className="hint">state rule key</span></span><input name="waitRuleKey" defaultValue={s?.waitRuleKey ?? ""} placeholder="e.g., NY.permissive_referendum_days" /></label>
      <label className="check"><input type="checkbox" name="needsMeeting" defaultChecked={s?.needsMeeting ?? false} /> Happens at a board meeting</label>
      <label className="field full"><span>Notes</span><textarea name="notes" defaultValue={s?.notes ?? ""} /></label>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="panel facts">
        <div><div className="k">Governing body</div><div className="v">{org.governingBody ?? "—"}</div></div>
        <div><div className="k">Regular meetings</div><div className="v">{pText || <span style={{ color: "var(--warn)" }}>Not set. Add it on the organization so board steps land on real meeting dates.</span>}</div></div>
        <div><div className="k">Agenda closes</div><div className="v">{org.agendaDeadlineDays != null ? `${org.agendaDeadlineDays} days before` : "—"}</div></div>
        <div><div className="k">Vote rules</div><div className="v">{org.voteRules ?? "—"}</div></div>
        <div><div className="k">Deadline</div><div className="v">{fmtDate(opp.approvalsDeadline)}</div></div>
      </section>

      {canEdit && (
        <section className="panel flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {template ? (
              steps.length ? (
                <form action={loadTemplate.bind(null, oppId, org.state)} className="flex items-center gap-2">
                  <ConfirmButton label={`Replace with the ${template.title} template`} confirmLabel="Click again: replaces every step below" />
                </form>
              ) : (
                <form action={loadTemplate.bind(null, oppId, org.state)}><button className="btn">Load the {template.title} template</button></form>
              )
            ) : <span className="muted text-sm">No approvals template for {org.state} yet. Add steps by hand below.</span>}
          </div>
          <SchedulerForm action={runScheduler.bind(null, oppId)} deadline={ymd(opp.approvalsDeadline)} buffer={opp.approvalsBufferDays ?? 7} />
        </section>
      )}

      {deadlineMissed && <p className="banner banner-bad mb-0">At least one step is dated after the deadline. Run the scheduler again or adjust the dates.</p>}

      {steps.length ? (
        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => {
            const d = s.meetingDate ? daysFromToday(s.meetingDate) : null;
            const wait = s.waitRuleKey ? rules[s.waitRuleKey]?.value ?? null : s.waitAfterDays;
            return (
              <li key={s.id} className="panel" style={s.status === "DONE" ? { opacity: 0.7 } : undefined}>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="mono w-6 pt-0.5 text-sm" style={{ color: "var(--muted)" }}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <b>{s.label}</b>
                    <div className="muted text-xs">
                      {[s.body, DOCUMENT_LABELS[s.document], s.needsMeeting ? "board meeting" : null, s.ownerContact?.name].filter(Boolean).join(" · ")}
                      {wait != null && <> · then wait {wait} days{s.waitRuleKey && <span className="mono"> ({s.waitRuleKey})</span>}</>}
                      {s.waitRuleKey && wait == null && <> · wait <span className="conf">[confirm]</span> ({s.waitRuleKey})</>}
                    </div>
                    {s.notes && <div className="mt-0.5 text-[13px]">{s.notes}</div>}
                  </div>
                  <div className="text-right">
                    <div className="mono">{s.meetingDate ? fmtDate(s.meetingDate) : <span className="muted">no date</span>}</div>
                    {s.agendaDeadline && <div className={`text-xs ${s.status !== "DONE" && s.agendaDeadline < today ? "" : "muted"}`} style={s.status !== "DONE" && s.agendaDeadline < today ? { color: "var(--bad)" } : undefined}>agenda by {fmtDate(s.agendaDeadline, { year: false })}</div>}
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{s.dateSetBy === "scheduler" ? "proposed" : s.dateSetBy === "manual" ? "set by hand" : ""}</div>
                  </div>
                  <span className={`chip ${s.status === "DONE" ? "chip-ok" : d != null && d < 0 ? "chip-bad" : s.status === "SCHEDULED" ? "chip-brand" : ""}`}>
                    {STATUS_LABEL[s.status]}{s.status !== "DONE" && d != null && d < 0 ? " · past" : ""}
                  </span>
                </div>
                {canEdit && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-9">
                    {s.status !== "SCHEDULED" && s.status !== "DONE" && <form action={setStepStatus.bind(null, s.id, "SCHEDULED")}><button className="btn btn-sm">On the agenda</button></form>}
                    {s.status !== "DONE" && <form action={setStepStatus.bind(null, s.id, "DONE")}><button className="btn btn-sm">Mark done</button></form>}
                    {s.status === "DONE" && <form action={setStepStatus.bind(null, s.id, "PLANNED")}><button className="btn btn-sm">Reopen</button></form>}
                    <form action={moveStep.bind(null, s.id, -1)}><button className="btn btn-sm" disabled={i === 0} aria-label={`Move ${s.label} up`}>↑</button></form>
                    <form action={moveStep.bind(null, s.id, 1)}><button className="btn btn-sm" disabled={i === steps.length - 1} aria-label={`Move ${s.label} down`}>↓</button></form>
                    <details className="w-full">
                      <summary className="cursor-pointer text-xs" style={{ color: "var(--brand)" }}>Edit step</summary>
                      <div className="mt-2"><ActionForm action={updateStep.bind(null, s.id)} className="form cols-3" submitLabel="Save step">{stepFields(s)}</ActionForm></div>
                      <form action={deleteStep.bind(null, s.id)} className="mt-2"><ConfirmButton label="Delete step" confirmLabel="Click again to delete" /></form>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : <Empty title="No approval steps yet">{template ? `Load the ${template.title} template, pick a deadline and the scheduler proposes dates from the board's meeting calendar.` : "Add the owner's approval steps below."}</Empty>}

      {canEdit && (
        <details className="panel">
          <summary className="cursor-pointer font-semibold">Add a step</summary>
          <div className="mt-2"><ActionForm action={addStep.bind(null, oppId)} className="form cols-3" submitLabel="Add step">{stepFields()}</ActionForm></div>
        </details>
      )}
    </div>
  );
}
