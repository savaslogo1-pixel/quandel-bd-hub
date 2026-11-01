"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Stage } from "@/lib/pipeline";
import { moveStage } from "../opportunities/actions";

export type Card = {
  id: string; name: string; org: string; state: string; stage: number; lead: string; support: string[];
  value: number | null; probability: number | null; weighted: number; checklist: string | null;
  flags: { level: "bad" | "warn"; text: string }[]; outcome: string | null; joint: boolean;
};

const short = (n: number | null) => {
  if (n == null) return "—";
  const a = Math.abs(n);
  return a >= 1e6 ? `$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`;
};

export function Board({ stages, cards, canMove }: { stages: Stage[]; cards: Card[]; canMove: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [over, setOver] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ name: string; id: string; to: string; list: string[] } | null>(null);
  const [local, setLocal] = useState<Record<string, number>>({});
  const stageOf = (c: Card) => local[c.id] ?? c.stage;

  function drop(id: string, to: number) {
    const c = cards.find((x) => x.id === id);
    if (!c || stageOf(c) === to) return;
    setLocal((l) => ({ ...l, [id]: to }));
    start(async () => {
      const r = await moveStage(id, to);
      if (!r.ok) {
        setLocal((l) => { const n = { ...l }; delete n[id]; return n; });
        setMsg({ name: c.name, id, to: stages.find((s) => s.n === to)?.name ?? "", list: r.blockers ?? [r.error ?? "Couldn't move."] });
      } else {
        setMsg(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      {msg && (
        <div className="banner banner-bad" role="alert">
          <b><Link href={`/opportunities/${msg.id}`}>{msg.name}</Link> can't move to {msg.to} yet:</b>
          <ul className="mt-1 list-disc pl-5">{msg.list.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      )}
      <div className="overflow-x-auto pb-2" aria-busy={pending}>
        <div className="grid min-w-max auto-cols-[minmax(232px,1fr)] grid-flow-col gap-2.5">
          {stages.map((s) => {
            const list = cards.filter((c) => stageOf(c) === s.n).sort((a, b) => b.weighted - a.weighted);
            return (
              <section
                key={s.n}
                aria-label={`Stage ${s.n} ${s.name}`}
                onDragOver={(e) => { if (canMove) { e.preventDefault(); setOver(s.n); } }}
                onDragLeave={() => setOver((o) => (o === s.n ? null : o))}
                onDrop={(e) => { e.preventDefault(); setOver(null); drop(e.dataTransfer.getData("text/plain"), s.n); }}
                className="flex min-h-40 flex-col gap-2 rounded-md p-2"
                style={{ background: "var(--sunken)", outline: over === s.n ? "2px dashed var(--brand)" : undefined }}
              >
                <div className="flex items-baseline gap-1.5 px-1">
                  <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{s.n}</span>
                  <h2 className="text-[15px]">{s.name}</h2>
                  <span className="mono ml-auto text-xs" style={{ color: "var(--muted)" }}>{list.length}</span>
                </div>
                <div className="flex justify-between px-1 text-[11px]" style={{ color: "var(--muted)" }}>
                  <span title="Exit criteria">{s.exit}</span>
                </div>
                <div className="flex justify-between px-1 text-[11px]" style={{ color: "var(--muted)" }}>
                  <span>weighted</span><span className="mono">{short(list.reduce((a, c) => a + c.weighted, 0))}</span>
                </div>
                {list.map((c) => (
                  <Link
                    key={c.id}
                    href={`/opportunities/${c.id}`}
                    draggable={canMove}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                    className="flex flex-col gap-1 rounded-md border p-2.5 no-underline"
                    style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }}
                  >
                    <b className="leading-tight">{c.name}</b>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>{c.org} · {c.state}</span>
                    <span className="flex flex-wrap gap-1">
                      <span className={`co co-${c.lead}`} style={{ boxShadow: "0 0 0 2px var(--surface), 0 0 0 3px currentColor" }} title={`${c.lead} (lead)`}>{c.lead}</span>
                      {c.support.map((s2) => <span key={s2} className={`co co-${s2}`}>{s2}</span>)}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="mono">{short(c.value)}</span>
                      <span style={{ color: "var(--muted)" }}>· {c.probability ?? "?"}%</span>
                      {c.outcome && <span className={`chip ${c.outcome === "Won" ? "chip-ok" : c.outcome === "Lost" ? "chip-bad" : ""}`}>{c.outcome}</span>}
                      {c.checklist && <span className="chip" title="Delivery-method checklist">{c.checklist}</span>}
                      {c.joint && <span className="chip chip-warn" title="Joint pursuit">joint</span>}
                      {c.flags.length > 0 && <span className={`chip ${c.flags.some((f) => f.level === "bad") ? "chip-bad" : "chip-warn"}`} title={c.flags.map((f) => f.text).join("; ")}>⚑ {c.flags.length}</span>}
                    </span>
                  </Link>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
