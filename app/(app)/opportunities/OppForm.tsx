import type { Company, Opportunity } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { CheckField, CheckGroup, SelectField, TextArea, TextField } from "@/components/ui";
import { PICKLISTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { ymd } from "@/lib/format";
import { DELIVERY_METHODS, STAGES, deliveryLabel } from "@/lib/pipeline";
import { companies as loadCompanies, picklist } from "@/lib/picklists";

type Full = Opportunity & { supportCompanies: Company[]; rivalCompetitors?: { id: string }[] };

export async function OppForm({ action, opp, orgId, defaultOwnerId }: { action: (s: FormState, fd: FormData) => Promise<FormState>; opp?: Full; orgId?: string; defaultOwnerId?: string }) {
  const rivals = await prisma.competitor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const [types, cos, orgs, users] = await Promise.all([
    picklist(PICKLISTS.projectType),
    loadCompanies(),
    prisma.organization.findMany({ select: { id: true, name: true, state: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const o = opp;
  const d = (v: unknown) => (v == null ? "" : String(v));
  return (
    <ActionForm action={action} className="form cols-3" submitLabel={o ? "Save changes" : "Add opportunity"}>
      <TextField name="name" label="Opportunity name" required full defaultValue={o?.name} />
      <SelectField name="orgId" label="Owner" required options={orgs.map((x) => [x.id, `${x.name} · ${x.state}`])} defaultValue={o?.orgId ?? orgId} />
      <SelectField name="projectType" label="Project type" options={types} defaultValue={o?.projectType} />
      <SelectField name="deliveryMethod" label="Delivery method" options={DELIVERY_METHODS.map((m) => [m, deliveryLabel(m)])} defaultValue={o?.deliveryMethod} />
      <CheckField name="nonEnergyScope" label="Energy project that also needs roof, ADA or other non-energy work" defaultChecked={o?.nonEnergyScope} full />

      <div className="sect">Team</div>
      <SelectField name="leadCompanyId" label="Lead company" hint={o ? undefined : "leave blank to use cross-sell routing"} options={cos.map((c) => [c.id, `${c.code} · ${c.name}`])} defaultValue={o?.leadCompanyId} blank={o ? null : "Use routing suggestion"} />
      <SelectField name="ownerId" label="Pursuit owner" options={users.map((u) => [u.id, u.name ?? u.email])} defaultValue={o ? o.ownerId : defaultOwnerId} />
      {!o && <SelectField name="stage" label="Starting stage" options={STAGES.filter((s) => s.n <= 5).map((s) => [String(s.n), `${s.n} · ${s.name}`])} defaultValue="1" blank={null} />}
      <CheckGroup name="supportCompanies" label="Support companies" hint="any support company makes this a joint pursuit" options={cos.map((c) => [c.id, c.code])} selected={o?.supportCompanies.map((c) => c.id) ?? []} />

      <div className="sect">Value</div>
      <TextField name="estimatedValue" label="Estimated value ($)" inputMode="decimal" defaultValue={d(o?.estimatedValue)} />
      <TextField name="quandelScopeValue" label="Quandel scope value ($)" inputMode="decimal" defaultValue={d(o?.quandelScopeValue)} />
      <TextField name="probability" label="Probability (%)" inputMode="numeric" defaultValue={o?.probability} />

      <div className="sect">Key dates</div>
      <TextField name="rfqIssueDate" label="RFQ/RFP issue" type="date" defaultValue={ymd(o?.rfqIssueDate)} />
      <TextField name="preBidDate" label="Pre-bid" type="date" defaultValue={ymd(o?.preBidDate)} />
      <TextField name="dueDate" label="Due" type="date" defaultValue={ymd(o?.dueDate)} />
      <TextField name="interviewDate" label="Interview" type="date" defaultValue={ymd(o?.interviewDate)} />
      <TextField name="boardVoteDate" label="Board vote" type="date" defaultValue={ymd(o?.boardVoteDate)} />
      <TextField name="awardDate" label="Award" type="date" defaultValue={ymd(o?.awardDate)} />
      <TextField name="constructionStartDate" label="Construction start" type="date" defaultValue={ymd(o?.constructionStartDate)} />
      <TextField name="substantialCompletionDate" label="Substantial completion" type="date" defaultValue={ymd(o?.substantialCompletionDate)} />

      <div className="sect">Positioning</div>
      <CheckGroup name="rivalCompetitors" label="Competitors" hint="from the Competitors list" options={rivals.map((r) => [r.id, r.name])} selected={o?.rivalCompetitors?.map((r) => r.id) ?? []} />
      <TextField name="competitors" label="Other competitors" full hint="not in the list yet, comma-separated" defaultValue={o?.competitors} />
      <TextArea name="winThemes" label="Win themes" defaultValue={o?.winThemes} />
    </ActionForm>
  );
}
