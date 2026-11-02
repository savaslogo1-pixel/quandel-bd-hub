import type { Organization, Company } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { CheckField, CheckGroup, SelectField, TextArea, TextField } from "@/components/ui";
import { ORG_STATUS_LABELS, PICKLISTS, STATES, TIERS, WEEKDAYS, WEEK_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { ymd } from "@/lib/format";
import { companies as loadCompanies, picklist } from "@/lib/picklists";

type OrgWithCos = Organization & { companies: Company[] };

export async function OrgForm({ action, org, defaultOwnerId }: { action: (s: FormState, fd: FormData) => Promise<FormState>; org?: OrgWithCos; defaultOwnerId?: string }) {
  const [orgTypes, cos, users, parents] = await Promise.all([
    picklist(PICKLISTS.orgType),
    loadCompanies(),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.organization.findMany({ where: org ? { id: { not: org.id } } : {}, select: { id: true, name: true, state: true }, orderBy: { name: "asc" } }),
  ]);
  const o = org;
  const dec = (v: unknown) => (v == null ? "" : String(v));
  const weeks = (o?.meetingWeeksOfMonth ?? "").split(",").filter(Boolean);
  return (
    <ActionForm action={action} className="form cols-3" submitLabel={o ? "Save changes" : "Add organization"}>
      <TextField name="name" label="Name" required full defaultValue={o?.name} />
      <SelectField name="orgType" label="Type" required options={orgTypes} defaultValue={o?.orgType} />
      <SelectField name="state" label="State" required options={STATES} defaultValue={o?.state ?? "PA"} blank={null} />
      <TextField name="county" label="County" defaultValue={o?.county} />
      <TextField name="region" label="Region" hint="PA region, NY REDC region, MD county" defaultValue={o?.region} />
      <SelectField name="tier" label="Tier" options={TIERS.map((t) => [t, "Tier " + t])} defaultValue={o?.tier} />
      <SelectField name="status" label="Status" options={Object.entries(ORG_STATUS_LABELS)} defaultValue={o?.status ?? "TARGET"} blank={null} />
      <SelectField name="relationshipOwnerId" label="Relationship owner" options={users.map((u) => [u.id, u.name ?? u.email])} defaultValue={o ? o.relationshipOwnerId : defaultOwnerId} />
      <SelectField name="parentOrgId" label="Parent org" hint="e.g., the IU or BOCES" options={parents.map((p) => [p.id, `${p.name} · ${p.state}`])} defaultValue={o?.parentOrgId} />
      <TextField name="source" label="Source" placeholder="e.g., QES targets list" defaultValue={o?.source} />
      <TextField name="website" label="Website" type="url" defaultValue={o?.website} />
      <TextField name="address" label="Address" full defaultValue={o?.address} />
      <CheckGroup name="companies" label="Company tags" options={cos.map((c) => [c.id, `${c.code} · ${c.name}`])} selected={o?.companies.map((c) => c.id) ?? []} />

      <TextArea name="notes" label="Notes" hint="research notes; imports can add to this" defaultValue={o?.notes} />

      <div className="sect">Geography flags</div>
      <CheckField name="arcCounty" label="ARC county" defaultChecked={o?.arcCounty} />
      <CheckField name="energyCommunity" label="Energy community" defaultChecked={o?.energyCommunity} />
      <CheckField name="opportunityZoneTract" label="Opportunity Zone tract" defaultChecked={o?.opportunityZoneTract} />
      <CheckField name="disadvantagedCommunity" label="Disadvantaged community (NY)" defaultChecked={o?.disadvantagedCommunity} />
      <CheckField name="quandelTerritory" label="In Quandel territory" defaultChecked={o?.quandelTerritory} />
      <TextField name="fiscalStressStatus" label="Fiscal-stress status" hint="NY FSMS or PA Act 47" defaultValue={o?.fiscalStressStatus} />

      <div className="sect">Governance</div>
      <TextField name="governingBody" label="Governing body" placeholder="e.g., Board of School Directors" defaultValue={o?.governingBody} />
      <SelectField name="meetingWeekday" label="Board meets on" options={WEEKDAYS.map((d, i) => [String(i), d])} defaultValue={o?.meetingWeekday} />
      <TextField name="agendaDeadlineDays" label="Agenda deadline (days before)" inputMode="numeric" defaultValue={o?.agendaDeadlineDays} />
      <CheckGroup name="meetingWeeksOfMonth" label="Which weeks of the month" options={[1, 2, 3, 4, 5].map((w) => [String(w), WEEK_LABELS[w]])} selected={weeks} hint="e.g., 2nd and 4th" />
      <TextField name="meetingPatternNote" label="Meeting notes" hint="irregular schedules, work sessions" defaultValue={o?.meetingPatternNote} />
      <TextField name="voteRules" label="Vote rules" placeholder="e.g., two-thirds for bonds" defaultValue={o?.voteRules} />
      <CheckField name="permissiveReferendum" label="Permissive referendum applies" defaultChecked={o?.permissiveReferendum} />

      <div className="sect">Public-owner profile</div>
      <TextField name="population" label="Population" inputMode="numeric" defaultValue={o?.population} />
      <TextField name="enrollment" label="Enrollment" inputMode="numeric" defaultValue={o?.enrollment} />
      <TextField name="fiscalYearStart" label="Fiscal year starts" placeholder="e.g., July 1" defaultValue={o?.fiscalYearStart} />
      <TextField name="annualBudget" label="Annual budget ($)" inputMode="decimal" defaultValue={dec(o?.annualBudget)} />
      <TextField name="debtOutstanding" label="Debt outstanding ($)" inputMode="decimal" defaultValue={dec(o?.debtOutstanding)} />
      <TextField name="debtLimit" label="Debt limit ($)" inputMode="decimal" defaultValue={dec(o?.debtLimit)} />
      <TextField name="recentBondIssues" label="Recent bond issues" defaultValue={o?.recentBondIssues} />
      <TextField name="creditRating" label="Credit rating" defaultValue={o?.creditRating} />
      <TextField name="taxCapOverrideHistory" label="Tax-cap override history (NY)" defaultValue={o?.taxCapOverrideHistory} />

      <div className="sect">Facilities</div>
      <TextField name="buildingCount" label="Building count" inputMode="numeric" defaultValue={o?.buildingCount} />
      <TextField name="oldestBuildingYear" label="Oldest building (year)" inputMode="numeric" defaultValue={o?.oldestBuildingYear} />
      <TextField name="lastMajorRenovationYear" label="Last major renovation (year)" inputMode="numeric" defaultValue={o?.lastMajorRenovationYear} />
      <TextField name="lastEnergyProjectYear" label="Last energy project (year)" inputMode="numeric" defaultValue={o?.lastEnergyProjectYear} />
      <TextField name="lastEnergyProjectEsco" label="Last energy project ESCO" defaultValue={o?.lastEnergyProjectEsco} />
      <TextField name="capitalPlanUrl" label="Capital plan link" type="url" defaultValue={o?.capitalPlanUrl} />
      <TextField name="capitalPlanDate" label="Capital plan date" type="date" defaultValue={ymd(o?.capitalPlanDate)} />
      <TextField name="buildingConditionSurveyDate" label="Building condition survey (NY schools)" type="date" defaultValue={ymd(o?.buildingConditionSurveyDate)} />
    </ActionForm>
  );
}
