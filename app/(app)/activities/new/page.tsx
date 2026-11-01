import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canLogActivity } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createActivity } from "../actions";
import { ActivityForm } from "../ActivityForm";

export const metadata = { title: "Log activity" };

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<{ org?: string; contact?: string }> }) {
  const { org, contact } = await searchParams;
  const user = await requireUser();
  if (!canLogActivity(user.role)) redirect("/activities");
  const o = org ? await prisma.organization.findUnique({ where: { id: org }, include: { companies: true } }) : null;

  if (!o) {
    const orgs = await prisma.organization.findMany({ select: { id: true, name: true, state: true }, orderBy: { name: "asc" } });
    return (
      <>
        <PageHeader title="Log activity" sub="First, pick the organization." />
        {orgs.length ? (
          <form method="get" className="panel flex flex-wrap items-end gap-2">
            <label className="field min-w-[260px] flex-1">
              <span>Organization</span>
              <select name="org" required defaultValue="">
                <option value="" disabled>Choose…</option>
                {orgs.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.state}</option>)}
              </select>
            </label>
            <button className="btn btn-primary" type="submit">Continue</button>
          </form>
        ) : (
          <p className="banner banner-info">Add an organization first. <Link href="/organizations/new">Add organization</Link></p>
        )}
      </>
    );
  }

  // Default company tag: companies the user covers that this org also carries, else the user's own, else the org's.
  const mine = user.companies.map((c) => c.id);
  const overlap = o.companies.filter((c) => mine.includes(c.id)).map((c) => c.id);
  const defaults = overlap.length ? overlap : mine.length ? mine : o.companies.map((c) => c.id);

  return (
    <>
      <PageHeader title="Log activity" sub={<>at <Link href={`/organizations/${o.id}`}>{o.name}</Link></>} />
      <div className="panel">
        <ActivityForm action={createActivity.bind(null, o.id)} orgId={o.id} defaultContactId={contact} defaultCompanyIds={defaults} />
      </div>
    </>
  );
}
