"use client";

import { useActionState } from "react";
import { approveBid, setBidStatus } from "./actions";

const initial = {} as { error?: string };

/** Approve, dismiss, hold, or restore one feed item. Errors stay on the row. */
export function BidActions({ id, status }: { id: string; status: "NEW" | "DISMISSED" | "ON_HOLD" }) {
  const [approveState, approve, approvePending] = useActionState(approveBid.bind(null, id), initial);
  const [otherState, other, otherPending] = useActionState(setBidStatus.bind(null, id), initial);
  const pending = approvePending || otherPending;
  const error = approveState.error || otherState.error;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        <form action={approve}>
          <button className="btn btn-sm btn-primary" disabled={pending} type="submit">Approve</button>
        </form>
        {status !== "DISMISSED" && (
          <form action={other}>
            <input type="hidden" name="status" value="DISMISSED" />
            <button className="btn btn-sm" disabled={pending} type="submit">Dismiss</button>
          </form>
        )}
        {status === "NEW" && (
          <form action={other}>
            <input type="hidden" name="status" value="ON_HOLD" />
            <button className="btn btn-sm" disabled={pending} type="submit">Hold</button>
          </form>
        )}
        {status !== "NEW" && (
          <form action={other}>
            <input type="hidden" name="status" value="NEW" />
            <button className="btn btn-sm" disabled={pending} type="submit">Restore</button>
          </form>
        )}
      </div>
      {error && <span className="max-w-[220px] text-right text-xs" style={{ color: "var(--bad)" }}>{error}</span>}
    </div>
  );
}
