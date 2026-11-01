import type { FundingProgram } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { CheckField, SelectField, TextArea, TextField } from "@/components/ui";
import type { FormState } from "@/lib/forms";
import { ymd } from "@/lib/format";
import { JURISDICTIONS, MATCH_BASIS_LABELS, PROGRAM_TYPE_LABELS } from "@/lib/programs";

export function ProgramForm({ action, p }: { action: (s: FormState, fd: FormData) => Promise<FormState>; p?: FundingProgram }) {
  const d = (v: unknown) => (v == null ? "" : String(v));
  return (
    <ActionForm action={action} className="form cols-3" submitLabel={p ? "Save changes" : "Add program"}>
      <TextField name="name" label="Program" required full defaultValue={p?.name} />
      <SelectField name="jurisdiction" label="State or Federal" required options={JURISDICTIONS} defaultValue={p?.jurisdiction ?? "PA"} blank={null} />
      <TextField name="agency" label="Agency" defaultValue={p?.agency} />
      <SelectField name="programType" label="Type" options={Object.entries(PROGRAM_TYPE_LABELS)} defaultValue={p?.programType} />
      <TextField name="eligibleApplicants" label="Eligible applicants" full hint="e.g., municipalities, school districts, authorities" defaultValue={p?.eligibleApplicants} />
      <TextArea name="eligibleUses" label="Eligible uses" defaultValue={p?.eligibleUses} />
      <TextField name="minAward" label="Min award ($)" inputMode="decimal" defaultValue={d(p?.minAward)} />
      <TextField name="maxAward" label="Max award ($)" inputMode="decimal" defaultValue={d(p?.maxAward)} />
      <SelectField name="cycle" label="Cycle" options={["rolling", "annual", "other"]} defaultValue={p?.cycle} />
      <TextField name="matchPct" label="Match required (%)" inputMode="decimal" defaultValue={d(p?.matchPct)} />
      <SelectField name="matchBasis" label="Match measured against" options={Object.entries(MATCH_BASIS_LABELS)} defaultValue={p?.matchBasis} />
      <TextField name="matchType" label="Match type" hint="cash, in-kind, non-state funds…" defaultValue={p?.matchType} />
      <SelectField name="reimbursement" label="Reimbursement program" hint="pays after the owner spends" options={[["yes", "Yes"], ["no", "No"]]} defaultValue={p?.reimbursement == null ? "" : p.reimbursement ? "yes" : "no"} />
      <TextField name="nextDeadline" label="Next deadline" type="date" defaultValue={ymd(p?.nextDeadline)} />
      <TextField name="url" label="Program page" type="url" defaultValue={p?.url} />
      <TextField name="source" label="Source of these details" full hint="guidelines document, page and date" defaultValue={p?.source} />
      <TextArea name="notes" label="Notes" defaultValue={p?.notes} />
      <CheckField name="markVerified" label="I checked these details against the current guidelines today (sets Last verified)" full />
    </ActionForm>
  );
}
