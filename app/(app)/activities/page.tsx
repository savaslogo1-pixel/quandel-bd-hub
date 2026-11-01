import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Empty, PageHeader } from "@/components/ui";
import { PICKLISTS } from "@/lib/constants";
import { canLogActivity } from "@/lib/permissions";
import { companies as loadCompanies, picklist } from "@/lib/picklists";
import { requireUser } from "@/lib/session";
import { ActivityList } from "./ActivityList";

export const metadata = { title: "Activities" };

type SP = { type?: string; co?: string; mine?: string; open?: string; financing?: string };

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const where: Prisma.ActivityWhereInput = {};
  if (sp.type) where.type = sp.type;
  if (sp.co) where.companies = { some: { code: sp.co } };
  if (sp.mine) where.createdById = user.id;
  if (sp.open) Object.assign(where, { nextStep: { not: null }, nextStepDone: false });
  if (sp.financing === "unlinked") Object.assign(where, { financingDiscussed: true, financialAdvisorContactId: null });
  else if (sp.financing) where.financingDiscussed = true;
  const [types, cos] = await Promise.all([picklist(PICKLISTS.activityType), loadCompanies()]);
  const filtered = Object.values(sp).some(Boolean);
  return (
    <>
      <PageHeader title="Activities" sub="Calls, meetings, site walks, board meetings and more, newest first." actions={canLogActivity(user.role) && <Link className="btn btn-primary" href="/activities/new">Log activity</Link>} />
      <form className="filters" method="get">
        <select name="type" defaultValue={sp.type ?? ""}><option value="">All types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
        <select name="co" defaultValue={sp.co ?? ""}><option value="">All companies</option>{cos.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select>
        <select name="financing" defaultValue={sp.financing ?? ""}><option value="">Any</option><option value="yes">Financing discussed</option><option value="unlinked">Financing, no FA linked</option></select>
        <label className="check"><input type="checkbox" name="mine" value="1" defaultChecked={!!sp.mine} /> Logged by me</label>
        <label className="check"><input type="checkbox" name="open" value="1" defaultChecked={!!sp.open} /> Open next steps</label>
        <button className="btn btn-sm" type="submit">Apply</button>
        {filtered && <Link className="btn btn-sm" href="/activities">Clear</Link>}
      </form>
      <ActivityList where={where} empty={<Empty title={filtered ? "No activities match" : "No activities yet"}>{!filtered && "Log a call or meeting from any organization's page."}</Empty>} />
    </>
  );
}
