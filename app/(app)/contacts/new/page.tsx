import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canEditAccounts } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { createContact } from "../actions";
import { ContactForm } from "../ContactForm";

export const metadata = { title: "Add contact" };

export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ org?: string; added?: string }> }) {
  const { org, added } = await searchParams;
  const user = await requireUser();
  if (!canEditAccounts(user.role)) redirect("/contacts");
  const o = org ? await prisma.organization.findUnique({ where: { id: org }, select: { name: true } }) : null;
  return (
    <>
      <PageHeader title="Add contact" sub={o ? `at ${o.name}` : undefined} />
      {added && <p className="banner banner-info">Added {added}.</p>}
      <div className="panel"><ContactForm key={added ?? "new"} action={createContact} orgId={org} showAddAnother /></div>
    </>
  );
}
