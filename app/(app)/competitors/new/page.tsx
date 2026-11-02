import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { canEditAccounts } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { saveCompetitor } from "../actions";
import { CompetitorForm } from "../CompetitorForm";

export const metadata = { title: "Add competitor" };

export default async function NewCompetitor() {
  const user = await requireUser();
  if (!canEditAccounts(user.role)) redirect("/competitors");
  return (<><PageHeader title="Add competitor" /><div className="panel"><CompetitorForm action={saveCompetitor.bind(null, null)} /></div></>);
}
