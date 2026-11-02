import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { canEditAccounts } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createOrganization } from "../actions";
import { OrgForm } from "../OrgForm";

export const metadata = { title: "Add organization" };

export default async function NewOrgPage() {
  const user = await requireUser();
  if (!canEditAccounts(user.role)) redirect("/organizations");
  return (
    <>
      <PageHeader title="Add organization" sub="An owner or partner. Name + state + type + county must be unique." />
      <div className="panel"><OrgForm action={createOrganization} defaultOwnerId={user.id} /></div>
    </>
  );
}
