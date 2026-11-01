import Link from "next/link";
import type { Prisma, ProgramType } from "@prisma/client";
import { Confirm, Empty, PageHeader, VerifiedBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { daysFromToday, fmtDate, money, todayUTC } from "@/lib/format";
import { canEditPrograms } from "@/lib/permissions";
import { JURISDICTIONS, MATCH_BASIS_LABELS, PROGRAM_TYPE_LABELS, alertBand, verification } from "@/lib/programs";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Funding programs" };

type SP = { q?: string; j?: string; type?: string; due?: string; ver?: string };

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const today = todayUTC();
  const where: Prisma.FundingProgramWhereInput = {};
  if (sp.q) where.OR = [{ name: { contains: sp.q } }, { agency: { contains: sp.q } }, { eligibleUses: { contains: sp.q } }, { eligibleApplicants: { contains: sp.q } }, { notes: { contains: sp.q } }];
  if (sp.j && JURISDICTIONS.includes(sp.j)) where.jurisdiction = sp.j;
  if (sp.type && sp.type in PROGRAM_TYPE_LABELS) where.programType = sp.type as ProgramType;
  if (sp.due) where.nextDeadline = { gte: today, lte: new Date(today.getTime() + Number(sp.due) * 86_400_000) };
  const programs = await prisma.fundingProgram.findMany({
    where,
    include: { _count: { select: { stackRows: true } } },
    orderBy: [{ jurisdiction: "asc" }, { name: "asc" }],
  });
  const shown = sp.ver ? programs.filter((p) => (sp.ver === "current" ? verification(p.lastVerifiedAt) === "current" : verification(p.lastVerifiedAt) !== "current")) : programs;
  const needs = programs.filter((p) => verification(p.lastVerifiedAt) !== "current").length;
  const filtered = Object.values(sp).some(Boolean);
  let last = "";
  return (
    <>
      <PageHeader
        title="Funding program library"
        sub="One record per program, by state. Blank fields show [confirm] until someone fills them from the current guidelines and marks the program verified."
        actions={canEditPrograms(user.role) && <Link className="btn btn-primary" href="/programs/new">Add program</Link>}
      />
      {needs > 0 && !sp.ver && <p className="banner banner-warn">{needs} of {programs.length} programs here are unverified or more than 12 months old. <Link href="/programs?ver=needs">Show them</Link></p>}
      <form className="filters" method="get">
        <input name="q" type="search" placeholder="Search name, agency, uses, applicants" defaultValue={sp.q} />
        <select name="j" defaultValue={sp.j ?? ""}><option value="">All states + Federal</option>{JURISDICTIONS.map((j) => <option key={j}>{j}</option>)}</select>
        <select name="type" defaultValue={sp.type ?? ""}><option value="">All types</option>{Object.entries(PROGRAM_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="due" defaultValue={sp.due ?? ""}><option value="">Any deadline</option><option value="30">Due in 30 days</option><option value="90">Due in 90 days</option></select>
        <select name="ver" defaultValue={sp.ver ?? ""}><option value="">Any verification</option><option value="needs">Needs verification</option><option value="current">Verified this year</option></select>
        <button className="btn btn-sm" type="submit">Apply</button>
        {filtered && <Link className="btn btn-sm" href="/programs">Clear</Link>}
      </form>
      {shown.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Program</th><th>Agency</th><th>Type</th><th>Award range</th><th>Match</th><th>Reimb.</th><th>Next deadline</th><th className="num">On stacks</th><th>Verified</th></tr></thead>
            <tbody>
              {shown.flatMap((p) => {
                const rows = [];
                if (p.jurisdiction !== last) {
                  last = p.jurisdiction;
                  rows.push(<tr key={"g" + p.jurisdiction}><td colSpan={9} className="font-[family-name:var(--font-display)] text-sm uppercase tracking-wide" style={{ background: "var(--sunken)" }}>{p.jurisdiction}</td></tr>);
                }
                const left = p.nextDeadline ? daysFromToday(p.nextDeadline) : null;
                const band = left != null ? alertBand(left) : null;
                rows.push(
                  <tr key={p.id}>
                    <td><Link className="rowlink" href={`/programs/${p.id}`}>{p.name}</Link></td>
                    <td>{p.agency ?? <Confirm />}</td>
                    <td>{p.programType ? PROGRAM_TYPE_LABELS[p.programType] : <Confirm />}</td>
                    <td className="mono text-xs">{p.minAward != null || p.maxAward != null ? `${money(p.minAward)} – ${money(p.maxAward)}` : <Confirm />}</td>
                    <td className="text-xs">{p.matchPct != null ? `${Number(p.matchPct)}% ${MATCH_BASIS_LABELS[p.matchBasis ?? "PROJECT_COST"]}` : <Confirm />}</td>
                    <td>{p.reimbursement == null ? <Confirm /> : p.reimbursement ? "Yes" : "No"}</td>
                    <td>{p.nextDeadline ? <span className={`chip ${band == null ? "" : band <= 14 ? "chip-bad" : band <= 30 ? "chip-warn" : "chip-gold"}`}>{fmtDate(p.nextDeadline)}</span> : p.cycle ? <span className="muted text-xs">{p.cycle}</span> : <Confirm />}</td>
                    <td className="num">{p._count.stackRows || ""}</td>
                    <td><VerifiedBadge at={p.lastVerifiedAt} state={verification(p.lastVerifiedAt)} /></td>
                  </tr>,
                );
                return rows;
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={filtered ? "No programs match" : "No programs loaded"}>{!filtered && "Run npm run db:seed to load the program list from data/programs.json."}</Empty>
      )}
    </>
  );
}
