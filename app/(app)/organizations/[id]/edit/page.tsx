import { notFound, redirect } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canDelete, canEditAccounts } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { deleteOrganization, updateOrganization } from "../../actions";
import { OrgForm } from "../../OrgForm";

export const metadata = { title: "Edit organization" };

export default async function EditOrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canEditAccounts(user.role)) redirect(`/organizations/${id}`);
  const org = await prisma.organization.findUnique({ where: { id }, include: { companies: true } });
  if (!org) notFound();
  return (
    <>
      <PageHeader title={`Edit ${org.name}`} />
      <div className="panel"><OrgForm action={updateOrganization.bind(null, id)} org={org} /></div>
      {canDelete(user.role) && (
        <form action={deleteOrganization.bind(null, id)} className="mt-4 flex justify-end">
          <ConfirmButton label="Delete organization" confirmLabel="Click again: deletes its contacts and activities too" />
        </form>
      )}
    </>
  );
}
