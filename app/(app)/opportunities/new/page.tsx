import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { canEditOpportunities } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createOpportunity } from "../actions";
import { OppForm } from "../OppForm";

export const metadata = { title: "Add opportunity" };

export default async function NewOppPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  const user = await requireUser();
  if (!canEditOpportunities(user.role)) redirect("/pipeline");
  return (
    <>
      <PageHeader title="Add opportunity" sub="Leave the lead company blank and the cross-sell routing rules suggest one. A person makes the final call." />
      <div className="panel"><OppForm action={createOpportunity} orgId={org} defaultOwnerId={user.id} /></div>
    </>
  );
}
