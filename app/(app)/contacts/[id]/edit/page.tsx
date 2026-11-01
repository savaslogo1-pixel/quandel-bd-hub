import { notFound, redirect } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canDelete, canEditAccounts } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { deleteContact, updateContact } from "../../actions";
import { ContactForm } from "../../ContactForm";

export const metadata = { title: "Edit contact" };

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canEditAccounts(user.role)) redirect(`/contacts/${id}`);
  const c = await prisma.contact.findUnique({ where: { id }, include: { influences: { select: { id: true } } } });
  if (!c) notFound();
  return (
    <>
      <PageHeader title={`Edit ${c.name}`} />
      <div className="panel"><ContactForm action={updateContact.bind(null, id)} contact={c} /></div>
      {canDelete(user.role) && (
        <form action={deleteContact.bind(null, id)} className="mt-4 flex justify-end">
          <ConfirmButton label="Delete contact" confirmLabel="Click again to delete" />
        </form>
      )}
    </>
  );
}
