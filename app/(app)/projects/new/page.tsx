import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canEditAccounts } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { saveProject } from "../actions";
import { ProjectForm } from "../ProjectForm";

export const metadata = { title: "Add project" };

export default async function NewProject({ searchParams }: { searchParams: Promise<{ opp?: string }> }) {
  const { opp } = await searchParams;
  const user = await requireUser();
  if (!canEditAccounts(user.role)) redirect("/projects");
  const o = opp ? await prisma.opportunity.findUnique({ where: { id: opp }, include: { leadCompany: true, supportCompanies: true } }) : null;
  const defaults = o
    ? { opportunityId: o.id, name: o.name, orgId: o.orgId, projectType: o.projectType, deliveryMethod: o.deliveryMethod, value: o.quandelScopeValue ?? o.estimatedValue, companies: [o.leadCompany, ...o.supportCompanies], startYear: o.constructionStartDate?.getUTCFullYear() ?? null, completionYear: o.substantialCompletionDate?.getUTCFullYear() ?? null }
    : {};
  return (<><PageHeader title="Add project" sub={o ? `From the won opportunity "${o.name}".` : "Won or completed work, for references and qualification packages."} /><div className="panel"><ProjectForm action={saveProject.bind(null, null)} p={defaults} /></div></>);
}
