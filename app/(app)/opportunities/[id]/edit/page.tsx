import { notFound, redirect } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canDelete, canEditOpportunities } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { deleteOpportunity, updateOpportunity } from "../../actions";
import { OppForm } from "../../OppForm";

export const metadata = { title: "Edit opportunity" };

export default async function EditOppPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) redirect(`/opportunities/${id}`);
  const o = await prisma.opportunity.findUnique({ where: { id }, include: { supportCompanies: true } });
  if (!o) notFound();
  return (
    <>
      <PageHeader title={`Edit ${o.name}`} sub="Stage, go/no-go, outcome and compliance are set on the opportunity page." />
      <div className="panel"><OppForm action={updateOpportunity.bind(null, id)} opp={o} /></div>
      {canDelete(user.role) && (
        <form action={deleteOpportunity.bind(null, id)} className="mt-4 flex justify-end">
          <ConfirmButton label="Delete opportunity" confirmLabel="Click again to delete" />
        </form>
      )}
    </>
  );
}
