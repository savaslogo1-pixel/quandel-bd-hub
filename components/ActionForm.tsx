"use client";

import { startTransition, useActionState, type FormEvent, type ReactNode } from "react";
import type { FormState } from "@/lib/forms";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

/**
 * Wraps a server action: shows validation errors and disables submit while saving.
 * Submits through onSubmit (not the form `action` prop) so React does not reset the
 * fields after a failed save; what the person typed stays in place.
 */
export function ActionForm({ action, children, submitLabel = "Save", className = "form", extraButtons }: { action: Action; children: ReactNode; submitLabel?: string; className?: string; extraButtons?: ReactNode }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const fe = state?.fieldErrors ?? {};
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name) fd.set(submitter.name, submitter.value);
    startTransition(() => formAction(fd));
  }
  return (
    <form onSubmit={onSubmit} noValidate>
      {(state?.error || Object.keys(fe).length > 0) && (
        <div className="banner banner-bad" role="alert">
          {state?.error && <div><b>{state.error}</b></div>}
          {Object.keys(fe).length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {Object.entries(fe).map(([k, v]) => <li key={k}><b>{k}</b>: {v}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className={className}>{children}</div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {extraButtons}
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
