import type { Activity, Company, Contact } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { CheckField, CheckGroup, SelectField, TextArea, TextField } from "@/components/ui";
import { PICKLISTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { ymd } from "@/lib/format";
import { companies as loadCompanies, picklist } from "@/lib/picklists";

type Full = Activity & { contacts: Contact[]; companies: Company[] };

export async function ActivityForm({ action, orgId, activity, defaultContactId, defaultCompanyIds, defaultOppId, fromOpp }: { action: (s: FormState, fd: FormData) => Promise<FormState>; orgId: string; activity?: Full; defaultContactId?: string; defaultCompanyIds: string[]; defaultOppId?: string; fromOpp?: boolean }) {
  const [types, cos, contacts, advisors, opps] = await Promise.all([
    picklist(PICKLISTS.activityType),
    loadCompanies(),
    prisma.contact.findMany({ where: { orgId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { function: "financial advisor" }, include: { org: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.opportunity.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const a = activity;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ActionForm action={action} submitLabel={a ? "Save changes" : "Log activity"}>
      {fromOpp && <input type="hidden" name="from" value="opp" />}
      <SelectField name="type" label="Type" required options={types} defaultValue={a?.type ?? "call"} blank={null} />
      <TextField name="occurredAt" label="Date" type="date" required defaultValue={a ? ymd(a.occurredAt) : today} />
      <SelectField name="opportunityId" label="Opportunity" hint={opps.length ? undefined : "none at this organization yet"} options={opps.map((x) => [x.id, x.name])} defaultValue={a ? a.opportunityId : defaultOppId} />
      <CheckGroup name="companies" label="Company" hint="which Quandel company this touch was for" options={cos.map((c) => [c.id, c.code])} selected={a ? a.companies.map((c) => c.id) : defaultCompanyIds} />
      <CheckGroup
        name="contacts"
        label="Contacts"
        options={contacts.map((c) => [c.id, c.name + (c.doNotContact ? " (do not contact)" : "")])}
        selected={a ? a.contacts.map((c) => c.id) : defaultContactId ? [defaultContactId] : []}
        hint={contacts.length ? undefined : "no contacts at this organization yet"}
      />
      <TextArea name="notes" label="Notes" defaultValue={a?.notes} />
      <TextField name="nextStep" label="Next step" defaultValue={a?.nextStep} />
      <TextField name="nextStepDate" label="Next step date" type="date" defaultValue={ymd(a?.nextStepDate)} />
      {a?.nextStep && <CheckField name="nextStepDone" label="Next step done" defaultChecked={a.nextStepDone} full />}

      <div className="sect">Board meeting log <span className="muted text-xs font-normal">(if you attended a board meeting)</span></div>
      <TextField name="agendaItems" label="Agenda items relevant to us" full defaultValue={a?.agendaItems} />
      <TextField name="votesTaken" label="Votes taken" defaultValue={a?.votesTaken} />
      <TextField name="minutesUrl" label="Minutes link" type="url" defaultValue={a?.minutesUrl} />

      <div className="sect">Municipal-advisor flag</div>
      <CheckField name="financingDiscussed" label="Financing was discussed (bonds, notes, loans, lease-purchase, debt structure)" defaultChecked={a?.financingDiscussed} full />
      <SelectField
        name="financialAdvisorContactId"
        label="Owner's financial advisor"
        hint="required when financing was discussed"
        full
        options={advisors.map((c) => [c.id, `${c.name} · ${c.org.name}`])}
        defaultValue={a?.financialAdvisorContactId}
      />
      <p className="muted full text-xs">Quandel staff don't give advice on how an owner should finance a project. Point financing questions to the owner's financial advisor and log it here.</p>
    </ActionForm>
  );
}
