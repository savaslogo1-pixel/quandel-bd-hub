import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { openFlags } from "@/lib/complianceData";
import { ExportLinks } from "@/components/ExportLinks";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Compliance" };

export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  await requireUser();
  const all = await openFlags();
  const flags = kind ? all.filter((f) => f.kind === kind) : all;
  const kinds = [...new Set(all.map((f) => f.kind))];
  return (
    <>
      <PageHeader title="Open compliance flags" sub="Procurement fairness, related-company disclosure, procurement independence, NY A/E certification and restricted periods, trade secrets, municipal-advisor flags, gifts and lobbying thresholds, in one list. Fix each at its source." actions={<ExportLinks table="flags" />} />
      <p className="banner banner-info">Emails, proposals and CRM records about public owners may be public records (PA Right-to-Know: 5 business days; NY FOIL: 5 to acknowledge, 20 to respond; see State rules). Write accordingly, and mark trade secrets on every submission.</p>
      <nav className="filters">
        <Link href="/compliance" className={`btn btn-sm ${!kind ? "btn-primary" : ""}`}>All · {all.length}</Link>
        {kinds.map((k) => <Link key={k} href={`/compliance?kind=${encodeURIComponent(k)}`} className={`btn btn-sm ${kind === k ? "btn-primary" : ""}`}>{k} · {all.filter((f) => f.kind === k).length}</Link>)}
      </nav>
      {flags.length ? (
        <ul className="rows panel">
          {flags.map((f, i) => (
            <li key={i}>
              <span className={`chip chip-${f.level}`}>{f.level === "bad" ? "⛔ Stop" : "⚠ Check"}</span>
              <div className="min-w-0 flex-1"><Link href={f.href} className="font-semibold">{f.text}</Link><div className="muted text-xs">{f.kind} · {f.where}</div></div>
            </li>
          ))}
        </ul>
      ) : <Empty title="No open flags" />}
    </>
  );
}
