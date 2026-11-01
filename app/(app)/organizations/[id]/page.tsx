import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyTags, Empty, Fact, Strength, Tabs } from "@/components/ui";
import { DECISION_ROLES, DECISION_ROLE_LABELS, ORG_STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { addDays, meetingsBetween, parsePattern, patternText } from "@/lib/meetings";
import { fmtDate, money, num, todayUTC } from "@/lib/format";
import { canEditAccounts, canLogActivity } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { ActivityList } from "../../activities/ActivityList";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await prisma.organization.findUnique({ where: { id }, select: { name: true } });
  return { title: o?.name ?? "Organization" };
}

export default async function OrgPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "profile" } = await searchParams;
  const user = await requireUser();
  const o = await prisma.organization.findUnique({
    where: { id },
    include: {
      companies: { orderBy: { sortOrder: "asc" } },
      relationshipOwner: true,
      parentOrg: true,
      childOrgs: { select: { id: true, name: true } },
      contacts: { include: { influences: { select: { id: true, name: true } } }, orderBy: { name: "asc" } },
      _count: { select: { activities: true } },
    },
  });
  if (!o) notFound();
  const pattern = parsePattern(o.meetingWeekday, o.meetingWeeksOfMonth);
  const pText = patternText(pattern);
  const base = `/organizations/${o.id}`;
  const today = todayUTC();
  const canEdit = canEditAccounts(user.role);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Organization · {o.orgType} · {o.state}</div>
          <h1 className="text-[28px] font-semibold">{o.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CompanyTags codes={o.companies} />
            {o.tier && <span className={`chip ${o.tier === "A" ? "chip-gold" : ""}`}>Tier {o.tier}</span>}
            <span className="chip">{ORG_STATUS_LABELS[o.status]}</span>
            {o.arcCounty && <span className="chip chip-brand">ARC county</span>}
            {o.energyCommunity && <span className="chip chip-brand">Energy community</span>}
            {o.opportunityZoneTract && <span className="chip chip-brand">Opportunity Zone</span>}
            {o.disadvantagedCommunity && <span className="chip chip-brand">Disadvantaged community</span>}
            {o.fiscalStressStatus && <span className="chip chip-warn">{o.fiscalStressStatus}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canLogActivity(user.role) && <Link className="btn btn-primary" href={`/activities/new?org=${o.id}`}>Log activity</Link>}
          {canEdit && <Link className="btn" href={`/contacts/new?org=${o.id}`}>Add contact</Link>}
          {canEdit && <Link className="btn" href={`${base}/edit`}>Edit</Link>}
        </div>
      </div>
      <Tabs base={base} current={tab} tabs={[["profile", "Profile"], ["contacts", `Contacts · ${o.contacts.length}`], ["map", "Decision map"], ["activities", `Activities · ${o._count.activities}`]]} />

      {tab === "profile" && (
        <div className="flex flex-col gap-4">
          <section className="panel facts">
            <Fact k="Relationship owner">{o.relationshipOwner ? o.relationshipOwner.name ?? o.relationshipOwner.email : "—"}</Fact>
            <Fact k="County · region">{[o.county, o.region].filter(Boolean).join(" · ") || "—"}</Fact>
            <Fact k="Parent org">{o.parentOrg ? <Link href={`/organizations/${o.parentOrg.id}`}>{o.parentOrg.name}</Link> : "—"}</Fact>
            <Fact k="Member orgs">{o.childOrgs.length ? o.childOrgs.map((c, i) => <span key={c.id}>{i > 0 && ", "}<Link href={`/organizations/${c.id}`}>{c.name}</Link></span>) : "—"}</Fact>
            <Fact k="Website">{o.website ? <a href={o.website} target="_blank" rel="noopener noreferrer">{o.website.replace(/^https?:\/\//, "")}</a> : "—"}</Fact>
            <Fact k="Address">{o.address ?? "—"}</Fact>
            <Fact k="Source">{o.source ?? "—"}</Fact>
          </section>
          <section>
            <h2 className="mb-2 text-lg">Governance</h2>
            <div className="panel facts">
              <Fact k="Governing body">{o.governingBody ?? "—"}</Fact>
              <Fact k="Regular meetings">{pText || "—"}{o.meetingPatternNote && <div className="muted text-xs">{o.meetingPatternNote}</div>}</Fact>
              <Fact k="Agenda deadline">{o.agendaDeadlineDays != null ? `${o.agendaDeadlineDays} days before` : "—"}</Fact>
              <Fact k="Vote rules">{o.voteRules ?? "—"}</Fact>
              <Fact k="Permissive referendum">{o.permissiveReferendum ? "Yes" : "No"}</Fact>
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-lg">Public-owner profile</h2>
            <div className="panel facts">
              <Fact k="Population">{num(o.population)}</Fact>
              <Fact k="Enrollment">{num(o.enrollment)}</Fact>
              <Fact k="Annual budget">{money(o.annualBudget)}</Fact>
              <Fact k="Fiscal year starts">{o.fiscalYearStart ?? "—"}</Fact>
              <Fact k="Debt outstanding">{money(o.debtOutstanding)}</Fact>
              <Fact k="Debt limit">{money(o.debtLimit)}</Fact>
              <Fact k="Recent bond issues">{o.recentBondIssues ?? "—"}</Fact>
              <Fact k="Credit rating">{o.creditRating ?? "—"}</Fact>
              {o.state === "NY" && <Fact k="Tax-cap override history">{o.taxCapOverrideHistory ?? "—"}</Fact>}
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-lg">Facilities</h2>
            <div className="panel facts">
              <Fact k="Buildings">{num(o.buildingCount)}</Fact>
              <Fact k="Oldest building">{o.oldestBuildingYear ?? "—"}</Fact>
              <Fact k="Last major renovation">{o.lastMajorRenovationYear ?? "—"}</Fact>
              <Fact k="Last energy project">{[o.lastEnergyProjectYear, o.lastEnergyProjectEsco].filter(Boolean).join(" · ") || "—"}</Fact>
              <Fact k="Capital plan">{o.capitalPlanUrl ? <><a href={o.capitalPlanUrl} target="_blank" rel="noopener noreferrer">Link</a>{o.capitalPlanDate && ` · ${fmtDate(o.capitalPlanDate)}`}</> : "—"}</Fact>
              {o.state === "NY" && <Fact k="Building condition survey">{fmtDate(o.buildingConditionSurveyDate)}</Fact>}
            </div>
          </section>
        </div>
      )}

      {tab === "contacts" && (o.contacts.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Decision role</th><th>Function</th><th>Strength</th><th>Last touch</th><th>Next touch</th></tr></thead>
            <tbody>
              {o.contacts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link className="rowlink" href={`/contacts/${c.id}`}>{c.name}</Link>
                    {c.doNotContact && <span className="chip chip-bad ml-1">do not contact</span>}
                    <div className="muted text-xs">{[c.title, c.email, c.phone].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>{c.decisionRole ? DECISION_ROLE_LABELS[c.decisionRole] : "—"}</td>
                  <td className="text-xs">{c.function ?? "—"}</td>
                  <td><Strength n={c.relationshipStrength} /></td>
                  <td className="mono text-xs">{fmtDate(c.lastTouch)}</td>
                  <td>{c.nextTouch ? <span className={`chip ${c.nextTouch < today ? "chip-bad" : ""}`}>{fmtDate(c.nextTouch)}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No contacts yet" action={canEdit && <Link className="btn btn-primary" href={`/contacts/new?org=${o.id}`}>Add contact</Link>}>
          Add the board, manager, business manager, solicitor, engineer and financial advisor.
        </Empty>
      ))}

      {tab === "map" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section>
            <h2 className="mb-1 text-lg">Who decides</h2>
            <p className="muted mb-2 text-xs">Contacts grouped by decision role. Arrows show who each person influences (set on the contact).</p>
            <div className="dm">
              {DECISION_ROLES.map((r) => {
                const list = o.contacts.filter((c) => c.decisionRole === r);
                return (
                  <div key={r} className="dm-col">
                    <h3 className="px-1 text-[13px] uppercase tracking-wide">{DECISION_ROLE_LABELS[r]}</h3>
                    {list.length ? list.map((c) => (
                      <Link key={c.id} href={`/contacts/${c.id}`} className="dm-card">
                        <b>{c.name}</b>
                        <div className="muted">{c.title ?? c.function ?? ""}</div>
                        <Strength n={c.relationshipStrength} />
                        {c.influences.length > 0 && <div className="muted mt-1 text-[11.5px]">→ {c.influences.map((i) => i.name).join(", ")}</div>}
                      </Link>
                    )) : <span className="muted px-1 text-xs">—</span>}
                  </div>
                );
              })}
            </div>
            {o.contacts.some((c) => !c.decisionRole) && (
              <p className="muted mt-2 text-xs">No role set: {o.contacts.filter((c) => !c.decisionRole).map((c) => c.name).join(", ")}</p>
            )}
          </section>
          <section>
            <h2 className="mb-1 text-lg">{o.governingBody ?? "Board"} meetings</h2>
            <div className="panel">
              {pText ? (
                <>
                  <p className="muted mb-2 text-xs">{pText}{o.agendaDeadlineDays != null && ` · agenda closes ${o.agendaDeadlineDays} days before`}</p>
                  <ul className="rows">
                    {meetingsBetween(pattern, today, addDays(today, 120)).slice(0, 8).map((d) => (
                      <li key={d.toISOString()}>
                        <span className="mono">{fmtDate(d)}</span>
                        {o.agendaDeadlineDays != null && <span className="muted text-xs">agenda due {fmtDate(addDays(d, -o.agendaDeadlineDays), { year: false })}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">Add the meeting pattern (e.g., 2nd and 4th Tuesday) under Edit → Governance.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "activities" && <ActivityList where={{ orgId: o.id }} showOrg={false} empty={<Empty title="No activity logged" action={canLogActivity(user.role) && <Link className="btn btn-primary" href={`/activities/new?org=${o.id}`}>Log activity</Link>}>Log calls, meetings, site walks and board meetings attended.</Empty>} />}
    </>
  );
}
