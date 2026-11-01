"use client";

import { useActionState } from "react";
import type { ScheduleState } from "./approvalActions";

export function SchedulerForm({ action, deadline, buffer }: { action: (s: ScheduleState, fd: FormData) => Promise<ScheduleState>; deadline: string; buffer: number }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="field"><span>Deadline the last step must meet</span><input id="sched-deadline" type="date" name="deadline" defaultValue={deadline} required /></label>
        <label className="field" style={{ width: 170 }}><span>Buffer days between steps <span className="hint">when no rule sets a wait</span></span><input id="sched-buffer" name="bufferDays" inputMode="numeric" defaultValue={buffer} /></label>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Scheduling…" : "Propose dates"}</button>
      </div>
      {state?.error && <p className="banner banner-bad mb-0">{state.error}</p>}
      {state?.fieldErrors && <p className="banner banner-bad mb-0">{Object.entries(state.fieldErrors).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
      {state?.done && (
        <div className={`banner mb-0 ${state.warnings?.length ? "banner-warn" : "banner-info"}`} role="status">
          <b>Dates proposed.</b> Steps that aren't done now carry the latest date that still meets the deadline.
          {state.warnings?.length ? <ul className="mt-1 list-disc pl-5">{state.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
        </div>
      )}
    </form>
  );
}
