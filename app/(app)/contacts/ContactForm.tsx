import type { Contact } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { CheckField, CheckGroup, SelectField, TextField } from "@/components/ui";
import { DECISION_ROLES, DECISION_ROLE_LABELS, PICKLISTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { ymd } from "@/lib/format";
import { picklist } from "@/lib/picklists";

export async function ContactForm({ action, contact, orgId, showAddAnother }: { action: (s: FormState, fd: FormData) => Promise<FormState>; contact?: Contact & { influences: { id: string }[] }; orgId?: string; showAddAnother?: boolean }) {
  const theOrg = contact?.orgId ?? orgId;
  const [fns, channels, orgs, peers] = await Promise.all([
    picklist(PICKLISTS.contactFunction),
    picklist(PICKLISTS.preferredChannel),
    prisma.organization.findMany({ select: { id: true, name: true, state: true }, orderBy: { name: "asc" } }),
    theOrg ? prisma.contact.findMany({ where: { orgId: theOrg, id: contact ? { not: contact.id } : undefined }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  const c = contact;
  return (
    <ActionForm
      action={action}
      className="form cols-3"
      submitLabel={c ? "Save changes" : "Add contact"}
      extraButtons={showAddAnother && <button type="submit" name="then" value="another" className="btn">Add and add another</button>}
    >
      <TextField name="name" label="Name" required defaultValue={c?.name} />
      <TextField name="title" label="Title" defaultValue={c?.title} />
      <SelectField name="orgId" label="Organization" required options={orgs.map((o) => [o.id, `${o.name} · ${o.state}`])} defaultValue={theOrg} />
      <SelectField name="decisionRole" label="Decision role" options={DECISION_ROLES.map((r) => [r, DECISION_ROLE_LABELS[r]])} defaultValue={c?.decisionRole} />
      <SelectField name="function" label="Function" options={fns} defaultValue={c?.function} />
      <SelectField name="relationshipStrength" label="Relationship strength" hint="1 = cold, 5 = trusted" options={["1", "2", "3", "4", "5"]} defaultValue={c?.relationshipStrength} />
      <TextField name="email" label="Email" type="email" defaultValue={c?.email} />
      <TextField name="phone" label="Phone" type="tel" defaultValue={c?.phone} />
      <TextField name="linkedinUrl" label="LinkedIn" type="url" defaultValue={c?.linkedinUrl} />
      <SelectField name="preferredChannel" label="Preferred channel" options={channels} defaultValue={c?.preferredChannel} />
      <TextField name="lastTouch" label="Last touch" type="date" defaultValue={ymd(c?.lastTouch)} />
      <TextField name="nextTouch" label="Next touch" type="date" defaultValue={ymd(c?.nextTouch)} />
      {theOrg ? (
        <CheckGroup name="influences" label="Influences" hint="who this person sways at the same organization (decision map)" options={peers.map((p) => [p.id, p.name])} selected={c?.influences.map((i) => i.id) ?? []} />
      ) : (
        <p className="muted full text-xs">Save first, then edit to set who this person influences.</p>
      )}
      <CheckField name="optOut" label="Opted out of email" defaultChecked={c?.optOut} />
      <CheckField name="doNotContact" label="Do not contact" defaultChecked={c?.doNotContact} />
    </ActionForm>
  );
}
