import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CompanyTags, Fact } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/format";
import { canDelete, canEditAccounts } from "@/lib/permissions";
import { deliveryLabel } from "@/lib/pipeline";
import { requireUser } from "@/lib/session";
import { deleteProject, saveProject } from "../actions";
import { ProjectForm } from "../ProjectForm";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const p = await prisma.project.findUnique({ where: { id }, include: { org: true, companies: { orderBy: { sortOrder: "asc" } }, referenceContact: true, opportunity: { select: { id: true, name: true } } } });
  if (!p) notFound();
  return (
    <>
      <div className="mb-4">
        <div className="eyebrow"><Link href="/projects">Projects</Link> · {p.status}</div>
        <h1 className="text-[28px] font-semibold">{p.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2"><CompanyTags codes={p.companies} /><Link href={`/organizations/${p.org.id}`}>{p.org.name}</Link><span className="muted">{p.org.state}</span></div>
      </div>
      <section className="panel facts mb-4">
        <Fact k="Project type">{p.projectType ?? "—"}</Fact>
        <Fact k="Delivery method">{deliveryLabel(p.deliveryMethod)}</Fact>
        <Fact k="Value">{money(p.value)}</Fact>
        <Fact k="Years">{[p.startYear, p.completionYear].filter(Boolean).join("–") || "—"}</Fact>
        <Fact k="Reference">{p.referenceContact ? <Link href={`/contacts/${p.referenceContact.id}`}>{p.referenceContact.name}</Link> : "—"}{p.referenceContact?.title && <div className="muted text-xs">{p.referenceContact.title}</div>}</Fact>
        <Fact k="Savings achieved">{p.annualSavingsAchieved != null ? `${money(p.annualSavingsAchieved)}/yr` : "—"}</Fact>
        <Fact k="From opportunity">{p.opportunity ? <Link href={`/opportunities/${p.opportunity.id}`}>{p.opportunity.name}</Link> : "—"}</Fact>
      </section>
      {p.results && <section className="panel mb-4"><h2 className="mb-1 text-lg">Results</h2><p className="whitespace-pre-wrap">{p.results}</p></section>}
      {p.photoUrls && <section className="panel mb-4"><h2 className="mb-1 text-lg">Photos</h2><ul>{p.photoUrls.split(/\n+/).filter(Boolean).map((u) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer">{u}</a></li>)}</ul></section>}
      {canEditAccounts(user.role) && <details className="panel"><summary className="cursor-pointer font-semibold">Edit project</summary><div className="mt-2"><ProjectForm action={saveProject.bind(null, id)} p={p} /></div>
        {canDelete(user.role) && <form action={deleteProject.bind(null, id)} className="mt-3"><ConfirmButton label="Delete project" confirmLabel="Click again to delete" /></form>}</details>}
    </>
  );
}
