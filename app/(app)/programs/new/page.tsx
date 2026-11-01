import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { canEditPrograms } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createProgram } from "../actions";
import { ProgramForm } from "../ProgramForm";

export const metadata = { title: "Add program" };

export default async function NewProgramPage() {
  const user = await requireUser();
  if (!canEditPrograms(user.role)) redirect("/programs");
  return (
    <>
      <PageHeader title="Add funding program" sub="Fill in only what the program guidelines say. Leave unknowns blank; they show as [confirm]." />
      <div className="panel"><ProgramForm action={createProgram} /></div>
    </>
  );
}
