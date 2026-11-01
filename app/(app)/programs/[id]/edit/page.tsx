import { notFound, redirect } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canDelete, canEditPrograms } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { deleteProgram, updateProgram } from "../../actions";
import { ProgramForm } from "../../ProgramForm";

export const metadata = { title: "Edit program" };

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canEditPrograms(user.role)) redirect(`/programs/${id}`);
  const p = await prisma.fundingProgram.findUnique({ where: { id } });
  if (!p) notFound();
  return (
    <>
      <PageHeader title={`Edit ${p.name}`} sub={`${p.jurisdiction} · seed key ${p.key}`} />
      <div className="panel"><ProgramForm action={updateProgram.bind(null, id)} p={p} /></div>
      {canDelete(user.role) && (
        <form action={deleteProgram.bind(null, id)} className="mt-4 flex justify-end">
          <ConfirmButton label="Delete program" confirmLabel="Click again to delete" />
        </form>
      )}
    </>
  );
}
