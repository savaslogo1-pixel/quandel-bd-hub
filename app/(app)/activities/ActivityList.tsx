import Link from "next/link";
import type { Prisma } from "@prisma/client";
import type { ReactNode } from "react";
import { CompanyTag } from "@/components/ui";
import { BOARD_MEETING_TYPE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fmtDate, todayUTC } from "@/lib/format";

export async function ActivityList({ where, showOrg = true, empty, take = 200 }: { where: Prisma.ActivityWhereInput; showOrg?: boolean; empty: ReactNode; take?: number }) {
  const acts = await prisma.activity.findMany({
    where,
    include: {
      org: { select: { id: true, name: true } },
      contacts: { select: { id: true, name: true } },
      companies: { select: { code: true }, orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true, email: true } },
      financialAdvisorContact: { select: { id: true, name: true } },
    },
    orderBy: { occurredAt: "desc" },
    take,
  });
  if (!acts.length) return <>{empty}</>;
  const today = todayUTC();
  return (
    <ul className="rows panel">
      {acts.map((a) => (
        <li key={a.id}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link className="font-bold" href={`/activities/${a.id}`}>{a.type[0].toUpperCase() + a.type.slice(1)}</Link>
              {a.contacts.length > 0 && <span>with {a.contacts.map((c, i) => <span key={c.id}>{i > 0 && ", "}<Link href={`/contacts/${c.id}`}>{c.name}</Link></span>)}</span>}
              {showOrg && <span className="muted">· <Link href={`/organizations/${a.org.id}`}>{a.org.name}</Link></span>}
              {a.companies.map((c) => <CompanyTag key={c.code} code={c.code} />)}
              {a.financingDiscussed && (
                <span className={`chip ${a.financialAdvisorContact ? "chip-warn" : "chip-bad"}`} title="Municipal-advisor flag">
                  financing discussed{a.financialAdvisorContact ? ` · FA ${a.financialAdvisorContact.name}` : " · no FA linked"}
                </span>
              )}
            </div>
            {a.notes && <div className="mt-0.5 whitespace-pre-wrap">{a.notes}</div>}
            {a.type === BOARD_MEETING_TYPE && (a.agendaItems || a.votesTaken || a.minutesUrl) && (
              <div className="muted mt-0.5 text-xs">
                Agenda: {a.agendaItems ?? "—"} · Votes: {a.votesTaken ?? "—"}
                {a.minutesUrl && <> · <a href={a.minutesUrl} target="_blank" rel="noopener noreferrer">minutes</a></>}
              </div>
            )}
            {a.nextStep && (
              <div className="mt-0.5 text-[13px]">
                <b>Next:</b> {a.nextStep}
                {a.nextStepDate && <> · <span className={`chip ${!a.nextStepDone && a.nextStepDate < today ? "chip-bad" : ""}`}>{fmtDate(a.nextStepDate, { year: false })}</span></>}
                {a.nextStepDone && <span className="chip chip-ok ml-1">done</span>}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="mono text-xs">{fmtDate(a.occurredAt)}</div>
            <div className="muted text-xs">{a.createdBy?.name ?? a.createdBy?.email ?? ""}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
