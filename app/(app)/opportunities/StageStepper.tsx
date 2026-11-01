"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Stage } from "@/lib/pipeline";
import { moveStage } from "./actions";

export function StageStepper({ id, stage, stages, canMove }: { id: string; stage: number; stages: Stage[]; canMove: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [blockers, setBlockers] = useState<{ to: string; list: string[] } | null>(null);
  const move = (to: number) =>
    start(async () => {
      setBlockers(null);
      const r = await moveStage(id, to);
      if (r.blockers?.length) setBlockers({ to: stages.find((s) => s.n === to)?.name ?? "", list: r.blockers });
      else if (r.error) setBlockers({ to: "", list: [r.error] });
      else router.refresh();
    });
  return (
    <div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Stage">
        {stages.map((s) => (
          <button
            key={s.n}
            type="button"
            disabled={!canMove || pending}
            onClick={() => s.n !== stage && move(s.n)}
            title={`Exit criteria: ${s.exit}`}
            aria-current={s.n === stage ? "step" : undefined}
            className="rounded-full border px-2.5 py-1 text-xs font-semibold"
            style={
              s.n === stage
                ? { background: "var(--brand)", borderColor: "var(--brand)", color: "var(--brand-ink)" }
                : { background: "var(--surface)", borderColor: "var(--line)", color: s.n < stage ? "var(--ink)" : "var(--muted)" }
            }
          >
            {s.n} {s.name}
          </button>
        ))}
      </div>
      {blockers && (
        <div className="banner banner-bad mt-2" role="alert">
          <b>{blockers.to ? `Can't move to ${blockers.to} yet:` : "Couldn't move:"}</b>
          <ul className="mt-1 list-disc pl-5">{blockers.list.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
