import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { canFacilitate } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import training from "@/data/training.json";

export const metadata = { title: "Certificate" };

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const c = await prisma.certificate.findUnique({ where: { id }, include: { user: true, edition: { include: { _count: { select: { sessions: true } } } } } });
  if (!c || (c.userId !== user.id && !canFacilitate(user.role))) notFound();
  return (
    <div className="mx-auto my-6 max-w-3xl rounded-lg border-4 p-10 text-center" style={{ borderColor: "var(--brand)", background: "var(--surface)" }}>
      <span className="inline-block rounded-md bg-white px-3 py-2"><Image src="/quandel-logo.png" alt="Quandel Enterprises" width={160} height={60} style={{ height: 48, width: "auto" }} /></span>
      <div className="eyebrow mt-6">Certificate of completion</div>
      <h1 className="mt-2 text-[34px] font-semibold">{c.user.name ?? c.user.email}</h1>
      <p className="mt-3 text-lg">completed the <b>{c.edition.title} edition</b> of</p>
      <p className="font-[family-name:var(--font-display)] text-2xl" style={{ color: "var(--brand)" }}>{training.course}</p>
      <p className="muted mt-2">{c.edition._count.sessions} sessions · Quandel Enterprises Business Development</p>
      <p className="mt-6 mono">{fmtDate(c.issuedAt)}</p>
      <p className="muted mt-6 text-xs">Use your browser's Print command to save or print this certificate.</p>
    </div>
  );
}
