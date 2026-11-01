import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { canDelete } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { deleteActivity, updateActivity } from "../actions";
import { ActivityForm } from "../ActivityForm";

export const metadata = { title: "Activity" };

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const a = await prisma.activity.findUnique({ where: { id }, include: { contacts: true, companies: true, org: true, createdBy: true } });
  if (!a) notFound();
  const editable = a.createdById === user.id || canDelete(user.role);
  return (
    <>
      <PageHeader
        title={`${a.type[0].toUpperCase() + a.type.slice(1)} · ${fmtDate(a.occurredAt)}`}
        sub={<>at <Link href={`/organizations/${a.org.id}`}>{a.org.name}</Link> · logged by {a.createdBy?.name ?? a.createdBy?.email ?? "—"}</>}
      />
      {!editable && <p className="banner banner-info">Only the person who logged this activity, an admin or a BD director can change it.</p>}
      <div className="panel" style={editable ? undefined : { pointerEvents: "none", opacity: 0.85 }} aria-disabled={!editable}>
        <ActivityForm action={updateActivity.bind(null, id)} orgId={a.orgId} activity={a} defaultCompanyIds={[]} />
      </div>
      {editable && (
        <form action={deleteActivity.bind(null, id)} className="mt-4 flex justify-end">
          <ConfirmButton label="Delete activity" confirmLabel="Click again to delete" />
        </form>
      )}
    </>
  );
}
