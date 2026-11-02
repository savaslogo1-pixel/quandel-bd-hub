import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { CompanyTag, Empty, Fact, Tabs } from "@/components/ui";
import { CapitalStack } from "../CapitalStack";
import { Approvals } from "../Approvals";
import { Energy } from "../Energy";
import { loadRules, multiPrimeCheck } from "@/lib/rules";
import { prisma } from "@/lib/db";
import { fmtDate, money, ymd } from "@/lib/format";
import { canDecideGoNoGo, canEditOpportunities, canLogActivity } from "@/lib/permissions";
import {
  DISCLOSURE_LABELS, GO_NO_GO_LABELS, OUTCOME_LABELS, STAGES, checklistFor, complianceFlags, deliveryLabel,
  isJointQES, isNySchool, needsProcIndependence, stageName, weightedValue,
} from "@/lib/pipeline";
import { suggestCompanies } from "@/lib/routing";
import { requireUser } from "@/lib/session";
import { ActivityList } from "../../activities/ActivityList";
import { applyRouting, setCompliance, setGoNoGo, setOutcome } from "../actions";
import { ChecklistItem } from "../ChecklistItem";
import { toGate } from "../data";
import { StageStepper } from "../StageStepper";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await prisma.opportunity.findUnique({ where: { id }, select: { name: true } });
  return { title: o?.name ?? "Opportunity" };
}

export default async function OppPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const user = await requireUser();
  const o = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      org: true,
      leadCompany: true,
      supportCompanies: { orderBy: { sortOrder: "asc" } },
      owner: true,
      rivalCompetitors: { select: { id: true, name: true } },
      lostTo: { select: { id: true, name: true } },
      projects: { select: { id: true, name: true } },
      goNoGoApprover: true,
      procIndependenceBy: true,
      disclosureBy: true,
      checklist: { include: { doneBy: { select: { name: true, email: true } } } },
      stageChanges: { include: { changedBy: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } },
      _count: { select: { stackRows: true, approvalSteps: true, measures: true } },
    },
  });
  if (!o) notFound();
  const g = toGate(o);
  const flags = complianceFlags(g);
  const cl = checklistFor(o.deliveryMethod);
  const canEdit = canEditOpportunities(user.role);
  const joint = isJointQES(g);
  const route = suggestCompanies({ projectType: o.projectType, deliveryMethod: o.deliveryMethod, nonEnergyScope: o.nonEnergyScope, org: o.org });
  const missing = route.codes.filter((c) => !g.companyCodes.includes(c));
  const who = (u: { name: string | null; email: string } | null) => (u ? u.name ?? u.email : "—");
  const mp = o.deliveryMethod === "MULTIPLE_PRIME_BID" || o.deliveryMethod === "SINGLE_PRIME_BID" || !o.deliveryMethod
    ? multiPrimeCheck(await loadRules(), o.org, o.estimatedValue != null ? Number(o.estimatedValue) : null)
    : null;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Opportunity · stage {o.stage} {stageName(o.stage)} · entered {fmtDate(o.stageEnteredAt)}</div>
          <h1 className="text-[28px] font-semibold">{o.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CompanyTag code={o.leadCompany.code} lead />
            {o.supportCompanies.map((c) => <CompanyTag key={c.id} code={c.code} />)}
            <Link href={`/organizations/${o.org.id}`}>{o.org.name}</Link>
            <span className="muted">{o.org.state}</span>
            {o.outcome && <span className={`chip ${o.outcome === "WON" ? "chip-ok" : o.outcome === "LOST" ? "chip-bad" : ""}`}>{OUTCOME_LABELS[o.outcome]}</span>}
            {joint && <span className="chip chip-warn">Joint pursuit · disclosure</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canLogActivity(user.role) && <Link className="btn btn-primary" href={`/activities/new?org=${o.org.id}&opp=${o.id}`}>Log activity</Link>}
          {canEdit && <Link className="btn" href={`/opportunities/${o.id}/edit`}>Edit</Link>}
          {o.projects.length ? <Link className="btn" href={`/projects/${o.projects[0].id}`}>Project record</Link> : canEdit && (o.stage === 10 || o.outcome === "WON") && <Link className="btn" href={`/projects/new?opp=${o.id}`}>Create project record</Link>}
        </div>
      </div>

      {joint && (
        <div className={`banner ${o.disclosureDecision === "ONE_TEAM_ACCEPTED" ? "banner-info" : o.disclosureDecision === "SEPARATE_PROCUREMENT_REQUIRED" ? "banner-bad" : "banner-warn"}`}>
          <b>Related-company disclosure.</b> QES and a Quandel construction company both touch this owner. The owner must know about the related-company role and decide whether one team is acceptable.{" "}
          {o.disclosureDecision ? <>Recorded: <b>{DISCLOSURE_LABELS[o.disclosureDecision]}</b> ({who(o.disclosureBy)}, {fmtDate(o.disclosureAt)}).</> : "Record the owner's decision under Compliance below."}
        </div>
      )}

      <section className="mb-5">
        <StageStepper id={o.id} stage={o.stage} stages={STAGES} canMove={canEdit} />
        <p className="muted mt-1.5 text-xs">Exit criteria for {stageName(o.stage)}: {STAGES.find((s) => s.n === o.stage)?.exit}</p>
      </section>

      <Tabs base={`/opportunities/${o.id}`} current={tab} tabs={[["overview", "Overview"], ["stack", `Capital stack · ${o._count.stackRows}`], ["approvals", `Approvals · ${o._count.approvalSteps}`], ["energy", `Energy · ${o._count.measures}`]]} />
      {tab === "energy" ? (
        <Energy oppId={o.id} canEdit={canEdit} />
      ) : tab === "approvals" ? (
        <Approvals oppId={o.id} canEdit={canEdit} />
      ) : tab === "stack" ? (
        <CapitalStack oppId={o.id} orgState={o.org.state} projectCost={o.estimatedValue != null ? Number(o.estimatedValue) : null} canEdit={canEdit} />
      ) : (

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="panel facts">
            <Fact k="Project type">{o.projectType ?? "—"}{o.nonEnergyScope && <div className="muted text-xs">+ non-energy work</div>}</Fact>
            <Fact k="Delivery method">{deliveryLabel(o.deliveryMethod)}</Fact>
            <Fact k="Pursuit owner">{who(o.owner)}</Fact>
            <Fact k="Estimated value">{money(o.estimatedValue)}</Fact>
            <Fact k="Quandel scope">{money(o.quandelScopeValue)}</Fact>
            <Fact k="Probability">{o.probability != null ? `${o.probability}%` : "—"}</Fact>
            <Fact k="Weighted value">{money(weightedValue(o))}</Fact>
            <Fact k="Competitors">{o.rivalCompetitors.length || o.competitors ? <>{o.rivalCompetitors.map((r, i) => <span key={r.id}>{i > 0 && ", "}<Link href={`/competitors/${r.id}`}>{r.name}</Link></span>)}{o.competitors && `${o.rivalCompetitors.length ? ", " : ""}${o.competitors}`}</> : "—"}{o.lostTo && <div className="text-xs" style={{ color: "var(--bad)" }}>Lost to <Link href={`/competitors/${o.lostTo.id}`}>{o.lostTo.name}</Link></div>}</Fact>
            <Fact k="Win themes">{o.winThemes ?? "—"}</Fact>
            {mp && (
              <Fact k={`Multiple-prime · ${mp.label}`}>
                {mp.threshold == null ? <>Threshold <span className="conf">[confirm]</span> in State rules</> : mp.applies == null ? "Add an estimated value to check" : mp.applies ? <span className="chip chip-warn">Likely applies (≥ {money(mp.threshold)})</span> : <>Below {money(mp.threshold)}</>}
              </Fact>
            )}
          </section>

          {missing.length > 0 && (
            <div className="banner banner-info flex flex-wrap items-center gap-2">
              <span><b>Routing suggests adding {missing.join(" + ")}.</b> {route.reasons.join("; ")}.</span>
              {canEdit && <form action={applyRouting.bind(null, o.id)}><button className="btn btn-sm">Add as support</button></form>}
            </div>
          )}

          {cl ? (
            <section>
              <h2 className="mb-1 text-lg">{cl.title} checklist <span className="mono muted text-sm">{cl.items.filter((i) => o.checklist.some((c) => c.itemKey === i.key)).length}/{cl.items.length}</span></h2>
              <div className="panel">
                {cl.items.map((i) => {
                  const d = o.checklist.find((c) => c.itemKey === i.key);
                  return <ChecklistItem key={i.key} id={o.id} itemKey={i.key} label={i.label} done={!!d} doneNote={d ? `${fmtDate(d.doneAt, { year: false })} · ${who(d.doneBy)}` : undefined} disabled={!canEdit} />;
                })}
              </div>
            </section>
          ) : (
            <p className="muted text-xs">{o.deliveryMethod ? `${deliveryLabel(o.deliveryMethod)} has no checklist in the spec.` : "Set a delivery method to get its checklist."}</p>
          )}

          <section>
            <h2 className="mb-1 text-lg">Key dates</h2>
            <div className="panel facts">
              <Fact k="RFQ/RFP issue">{fmtDate(o.rfqIssueDate)}</Fact>
              <Fact k="Pre-bid">{fmtDate(o.preBidDate)}</Fact>
              <Fact k="Due">{fmtDate(o.dueDate)}</Fact>
              <Fact k="Interview">{fmtDate(o.interviewDate)}</Fact>
              <Fact k="Board vote">{fmtDate(o.boardVoteDate)}</Fact>
              <Fact k="Award">{fmtDate(o.awardDate)}</Fact>
              <Fact k="Construction start">{fmtDate(o.constructionStartDate)}</Fact>
              <Fact k="Substantial completion">{fmtDate(o.substantialCompletionDate)}</Fact>
            </div>
          </section>

          <section>
            <h2 className="mb-1 text-lg">Activity</h2>
            <ActivityList where={{ opportunityId: o.id }} showOrg={false} empty={<Empty title="No activity linked yet">Log a call or meeting and pick this opportunity.</Empty>} />
          </section>

          <section>
            <h2 className="mb-1 text-lg">Stage history</h2>
            <ul className="rows panel">
              {o.stageChanges.map((s) => (
                <li key={s.id}>
                  <span>{s.fromStage ? `${s.fromStage} ${stageName(s.fromStage)} → ` : ""}<b>{s.toStage} {stageName(s.toStage)}</b>{s.note && <span className="muted"> · {s.note}</span>}</span>
                  <span className="muted text-xs">{who(s.changedBy)} · {fmtDate(s.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="panel">
            <h2 className="mb-1 text-lg">Go / no-go</h2>
            {o.goNoGo ? (
              <p className="mb-2"><span className={`chip ${o.goNoGo === "GO" ? "chip-ok" : o.goNoGo === "NO_GO" ? "chip-bad" : ""}`}>{GO_NO_GO_LABELS[o.goNoGo]}</span> <span className="muted text-xs">{who(o.goNoGoApprover)} · {fmtDate(o.goNoGoAt)}</span>{o.goNoGoReason && <span className="block text-[13px]">{o.goNoGoReason}</span>}</p>
            ) : <p className="muted mb-2">Not decided. Required before Pursuit.</p>}
            {canDecideGoNoGo(user.role) ? (
              <ActionForm action={setGoNoGo.bind(null, o.id)} className="form" submitLabel="Record decision">
                <label className="field"><span>Decision</span><select name="goNoGo" defaultValue={o.goNoGo ?? ""}><option value="">Choose</option><option value="GO">Go</option><option value="NO_GO">No-go</option><option value="PENDING">Pending</option></select></label>
                <label className="field full"><span>Reason</span><textarea name="goNoGoReason" defaultValue={o.goNoGoReason ?? ""} /></label>
              </ActionForm>
            ) : <p className="muted text-xs">Recorded by leadership, a BD director or an admin.</p>}
          </section>

          <section className="panel">
            <h2 className="mb-1 text-lg">Compliance</h2>
            {flags.length ? (
              <ul className="mb-2 flex flex-col gap-1">{flags.map((f) => <li key={f.text}><span className={`chip chip-${f.level}`}>{f.level === "bad" ? "Stop" : "Check"}</span> {f.text}</li>)}</ul>
            ) : <p className="mb-2"><span className="chip chip-ok">No open flags</span></p>}
            {canEdit ? (
              <ActionForm action={setCompliance.bind(null, o.id)} className="form" submitLabel="Save compliance">
                <label className="field full">
                  <span>Did we help write specs or scoring? <span className="hint">Must be No to pursue.</span></span>
                  <select name="helpedWriteSpecs" defaultValue={o.helpedWriteSpecs === true ? "yes" : o.helpedWriteSpecs === false ? "no" : ""}>
                    <option value="">Not answered</option><option value="no">No</option><option value="yes">Yes</option>
                  </select>
                </label>
                {needsProcIndependence(g) && (
                  <label className="check full">
                    <input type="checkbox" name="procIndependence" defaultChecked={!!o.procIndependenceAt} />
                    <span>Procurement independence: QES did not write the owner's GESA/EPC RFP or scoring.{o.procIndependenceAt && <span className="muted text-xs"> Logged {fmtDate(o.procIndependenceAt)} by {who(o.procIndependenceBy)}.</span>}</span>
                  </label>
                )}
                {joint && (
                  <>
                    <label className="field full">
                      <span>Owner's disclosure decision</span>
                      <select name="disclosureDecision" defaultValue={o.disclosureDecision ?? ""}>
                        <option value="">Not disclosed yet</option>
                        {Object.entries(DISCLOSURE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </label>
                    <label className="field full"><span>Disclosure note <span className="hint">who decided, when, where it's recorded</span></span><textarea name="disclosureNote" defaultValue={o.disclosureNote ?? ""} /></label>
                  </>
                )}
                {isNySchool(g) && (
                  <label className="check full">
                    <input type="checkbox" name="aeNoConflictCert" defaultChecked={!!o.aeNoConflictCertAt} />
                    <span>A/E of record no-conflict certification received (8 NYCRR § 155.20){o.aeNoConflictCertAt && <span className="muted text-xs"> · {fmtDate(o.aeNoConflictCertAt)}</span>}</span>
                  </label>
                )}
              </ActionForm>
            ) : null}
            <p className="muted mt-2 text-xs">Proposals and emails may be public records (PA Right-to-Know, NY FOIL). Mark trade secrets on submission.</p>
          </section>

          {(o.stage >= 8 || o.outcome) && (
            <section className="panel">
              <h2 className="mb-1 text-lg">Result</h2>
              {canEdit ? (
                <ActionForm action={setOutcome.bind(null, o.id)} className="form" submitLabel="Save result">
                  <label className="field"><span>Outcome</span><select name="outcome" defaultValue={o.outcome ?? ""}><option value="">Choose</option><option value="WON">Won</option><option value="LOST">Lost</option><option value="NO_BID">No-bid</option></select></label>
                  <label className="field"><span>Board vote</span><input type="date" name="boardVoteDate" defaultValue={ymd(o.boardVoteDate)} /></label>
                  <label className="field full"><span>If lost, who won</span><select name="lostToId" defaultValue={o.lostToId ?? ""}><option value="">—</option>{(await prisma.competitor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                  <label className="field full"><span>Reason <span className="hint">required for Lost or No-bid</span></span><textarea name="lossReason" defaultValue={o.lossReason ?? ""} /></label>
                </ActionForm>
              ) : <p>{o.outcome ? OUTCOME_LABELS[o.outcome] : "—"} {o.lossReason}</p>}
            </section>
          )}
        </div>
      </div>
      )}
    </>
  );
}
