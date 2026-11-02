import { ExportLinks } from "@/components/ExportLinks";
import Link from "next/link";
import type { DeliveryMethod, Prisma, StateCode } from "@prisma/client";
import { Empty, PageHeader } from "@/components/ui";
import { STATES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { money } from "@/lib/format";
import { canEditOpportunities } from "@/lib/permissions";
import { DELIVERY_METHODS, OUTCOME_LABELS, STAGES, checklistFor, complianceFlags, deliveryLabel, isJointQES, weightedValue } from "@/lib/pipeline";
import { companies as loadCompanies } from "@/lib/picklists";
import { requireUser } from "@/lib/session";
import { oppInclude, toGate } from "../opportunities/data";
import { Board, type Card } from "./Board";

export const metadata = { title: "Pipeline" };

type SP = { co?: string; state?: string; dm?: string; mine?: string; q?: string };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const where: Prisma.OpportunityWhereInput = {};
  const and: Prisma.OpportunityWhereInput[] = [];
  if (sp.co) and.push({ OR: [{ leadCompany: { code: sp.co } }, { supportCompanies: { some: { code: sp.co } } }] });
  if (sp.state && STATES.includes(sp.state as StateCode)) where.org = { state: sp.state as StateCode };
  if (sp.dm && DELIVERY_METHODS.includes(sp.dm as DeliveryMethod)) where.deliveryMethod = sp.dm as DeliveryMethod;
  if (sp.mine) where.ownerId = user.id;
  if (sp.q) and.push({ OR: [{ name: { contains: sp.q } }, { org: { name: { contains: sp.q } } }] });
  if (and.length) where.AND = and;

  const [opps, cos] = await Promise.all([prisma.opportunity.findMany({ where, include: oppInclude }), loadCompanies()]);
  const cards: Card[] = opps.map((o) => {
    const cl = checklistFor(o.deliveryMethod);
    const done = cl ? cl.items.filter((i) => o.checklist.some((c) => c.itemKey === i.key)).length : 0;
    const g = toGate(o);
    return {
      id: o.id, name: o.name, org: o.org.name, state: o.org.state, stage: o.stage,
      lead: o.leadCompany.code, support: o.supportCompanies.map((c) => c.code),
      value: o.estimatedValue != null ? Number(o.estimatedValue) : null, probability: o.probability,
      weighted: weightedValue(o), checklist: cl ? `${done}/${cl.items.length}` : null,
      flags: complianceFlags(g), outcome: o.outcome ? OUTCOME_LABELS[o.outcome] : null, joint: o.supportCompanies.length > 0 || isJointQES(g),
    };
  });
  const open = cards.filter((c) => c.stage < 9);
  const filtered = Object.values(sp).some(Boolean);

  return (
    <>
      <PageHeader
        title="Pipeline"
        sub="One shared stage list. Each delivery method adds its own checklist. Drag a card to move it; moves into Pursuit and beyond check go/no-go and compliance first."
        actions={<><ExportLinks table="opportunities" />{canEditOpportunities(user.role) && <Link className="btn btn-primary" href="/opportunities/new">Add opportunity</Link>}</>}
      />
      <form className="filters" method="get">
        <input name="q" type="search" placeholder="Search opportunities or owners" defaultValue={sp.q} />
        <select name="co" defaultValue={sp.co ?? ""}><option value="">All companies</option>{cos.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select>
        <select name="state" defaultValue={sp.state ?? ""}><option value="">All states</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select>
        <select name="dm" defaultValue={sp.dm ?? ""}><option value="">All delivery methods</option>{DELIVERY_METHODS.map((m) => <option key={m} value={m}>{deliveryLabel(m)}</option>)}</select>
        <label className="check"><input type="checkbox" name="mine" value="1" defaultChecked={!!sp.mine} /> My pursuits</label>
        <button className="btn btn-sm" type="submit">Apply</button>
        {filtered && <Link className="btn btn-sm" href="/pipeline">Clear</Link>}
        <span className="flex-1" />
        <span className="muted">{open.length} open · weighted <b className="mono" style={{ color: "var(--ink)" }}>{money(open.reduce((a, c) => a + c.weighted, 0))}</b></span>
      </form>
      {cards.length === 0 && (
        <div className="mb-3">
          <Empty title={filtered ? "No opportunities match" : "No opportunities yet"} action={!filtered && canEditOpportunities(user.role) ? <Link className="btn btn-primary" href="/opportunities/new">Add opportunity</Link> : undefined}>
            {!filtered && "Add one from an organization once a project and rough budget are in view."}
          </Empty>
        </div>
      )}
      <Board stages={STAGES} cards={cards} canMove={canEditOpportunities(user.role)} />
    </>
  );
}
