import type { Company, Project } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { CheckGroup, SelectField, TextArea, TextField } from "@/components/ui";
import { PICKLISTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { DELIVERY_METHODS, deliveryLabel } from "@/lib/pipeline";
import { companies as loadCompanies, picklist } from "@/lib/picklists";

type Defaults = Partial<Project> & { companies?: Company[] };

export async function ProjectForm({ action, p }: { action: (s: FormState, fd: FormData) => Promise<FormState>; p: Defaults }) {
  const [types, cos, orgs, contacts] = await Promise.all([
    picklist(PICKLISTS.projectType), loadCompanies(),
    prisma.organization.findMany({ select: { id: true, name: true, state: true }, orderBy: { name: "asc" } }),
    p.orgId ? prisma.contact.findMany({ where: { orgId: p.orgId }, select: { id: true, name: true, title: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const d = (v: unknown) => (v == null ? "" : String(v));
  return (
    <ActionForm action={action} className="form cols-3" submitLabel={p.id ? "Save project" : "Add project"}>
      {p.opportunityId && <input type="hidden" name="opportunityId" value={p.opportunityId} />}
      <TextField name="name" label="Project" required full defaultValue={p.name} />
      <SelectField name="orgId" label="Owner" required options={orgs.map((o) => [o.id, `${o.name} · ${o.state}`])} defaultValue={p.orgId} />
      <SelectField name="projectType" label="Project type" options={types} defaultValue={p.projectType} />
      <SelectField name="deliveryMethod" label="Delivery method" options={DELIVERY_METHODS.map((m) => [m, deliveryLabel(m)])} defaultValue={p.deliveryMethod} />
      <CheckGroup name="companies" label="Companies" options={cos.map((c) => [c.id, c.code])} selected={p.companies?.map((c) => c.id) ?? []} />
      <TextField name="value" label="Value ($)" inputMode="decimal" defaultValue={d(p.value)} />
      <SelectField name="status" label="Status" options={[["active", "Active"], ["completed", "Completed"]]} defaultValue={p.status ?? "active"} blank={null} />
      <TextField name="startYear" label="Start year" inputMode="numeric" defaultValue={p.startYear} />
      <TextField name="completionYear" label="Completion year" inputMode="numeric" defaultValue={p.completionYear} />
      {p.orgId ? <SelectField name="referenceContactId" label="Reference contact" options={contacts.map((c) => [c.id, `${c.name}${c.title ? ` · ${c.title}` : ""}`])} defaultValue={p.referenceContactId} /> : <p className="muted text-xs">Save first, then pick a reference contact at the owner.</p>}
      <TextField name="annualSavingsAchieved" label="Energy savings achieved ($/yr)" inputMode="decimal" defaultValue={d(p.annualSavingsAchieved)} />
      <TextArea name="results" label="Results" hint="what the owner got: savings, schedule, budget" defaultValue={p.results} />
      <TextArea name="photoUrls" label="Photo links" hint="one per line" defaultValue={p.photoUrls} />
      <TextArea name="notes" label="Notes" defaultValue={p.notes} />
    </ActionForm>
  );
}
