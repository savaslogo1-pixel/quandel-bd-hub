import type { Company, Competitor } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { CheckGroup, TextArea, TextField } from "@/components/ui";
import type { FormState } from "@/lib/forms";
import { companies as loadCompanies } from "@/lib/picklists";

export async function CompetitorForm({ action, c }: { action: (s: FormState, fd: FormData) => Promise<FormState>; c?: Competitor & { competesWith: Company[] } }) {
  const cos = await loadCompanies();
  return (
    <ActionForm action={action} className="form cols-3" submitLabel={c ? "Save" : "Add competitor"}>
      <TextField name="name" label="Name" required defaultValue={c?.name} />
      <TextField name="kind" label="Kind" placeholder="ESCO, general contractor, CM…" defaultValue={c?.kind} />
      <TextField name="website" label="Website" type="url" defaultValue={c?.website} />
      <CheckGroup name="competesWith" label="Competes with" options={cos.map((x) => [x.id, x.code])} selected={c?.competesWith.map((x) => x.id) ?? []} />
      <TextArea name="aliases" label="Other names" hint="as they appear on contracts and in minutes, one per line" defaultValue={c?.aliases} />
      <TextField name="headquarters" label="Headquarters" full defaultValue={c?.headquarters} />
      <TextField name="ownership" label="Ownership" full defaultValue={c?.ownership} />
      <TextArea name="profile" label="Profile" hint="offices, people, credentials" defaultValue={c?.profile} />
      <TextArea name="howTheyWin" label="How they win" defaultValue={c?.howTheyWin} />
      <TextArea name="pricingNotes" label="Pricing notes" defaultValue={c?.pricingNotes} />
      <TextArea name="ourResponse" label="Our response" defaultValue={c?.ourResponse} />
      <TextField name="source" label="Source" full defaultValue={c?.source} />
    </ActionForm>
  );
}
