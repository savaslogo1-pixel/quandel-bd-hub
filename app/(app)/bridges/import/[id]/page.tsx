import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { bridgePreview } from "@/lib/import/bridgeRun";
import { PRESETS } from "@/lib/import/presets";
import { canImport } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { commitBridges } from "../../actions";

export const metadata = { title: "Bridge import preview" };

export default async function BridgeImportPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canImport(user.role)) redirect("/bridges");
  const exists = await prisma.importBatch.findFirst({ where: { id, target: "bridges" }, select: { id: true } });
  if (!exists) notFound();
  const { b, preview, defaults } = await bridgePreview(id);
  const headers = JSON.parse(b.headers) as string[];
  const mapping = JSON.parse(b.mapping ?? "{}") as Record<string, number>;
  const preset = PRESETS.find((p) => p.id === defaults.presetId);
  if (b.status !== "DRAFT") {
    return (
      <>
        <PageHeader title={b.fileName} sub={`Imported: ${b.created} new bridges, ${b.updated} updated, ${b.skipped} skipped, ${b.errors} errors.`} />
        <Link className="btn btn-primary" href="/bridges">View bridges</Link>
      </>
    );
  }
  return (
    <>
      <PageHeader title={b.fileName} sub={`${b.rowCount} rows on the "${b.sheetName}" sheet. Nothing is saved until you click Import.`} />
      {preset && <p className="banner banner-info">Recognized: <b>{preset.label}</b>. {preset.notes}</p>}
      <section className="panel mb-4 text-[13px]">
        <b>Columns used:</b> {Object.entries(mapping).map(([f, i]) => `${f} ← "${headers[i]}"`).join(" · ")}
        <div className="muted mt-1">Bridges are matched on the NBI structure number when the file has one; otherwise on name + county + year built + traffic. Same-named bridges with different years (or identical twin spans) are kept as separate bridges.</div>
      </section>
      <p className="mb-2">{preview.counts.create} new · {preview.counts.update} update · {preview.counts.skip} skip · {preview.counts.error} errors</p>
      <div className="tbl-wrap mb-4">
        <table className="tbl">
          <thead><tr><th className="num">Row</th><th>Result</th><th>Bridge</th><th>County</th><th className="num">Built</th><th className="num">Vehicles/day</th><th>Owner</th><th>Note</th></tr></thead>
          <tbody>{preview.rows.slice(0, 200).map((r) => (
            <tr key={r.line}><td className="num">{r.line}</td><td><span className={`chip ${r.action === "create" ? "chip-ok" : r.action === "update" ? "chip-brand" : r.action === "error" ? "chip-bad" : ""}`}>{r.action}</span></td>
              <td>{r.draft?.name}</td><td>{r.draft?.county}</td><td className="num">{r.draft?.yearBuilt ?? ""}</td><td className="num">{r.draft?.adt?.toLocaleString() ?? ""}</td><td className="text-xs">{r.draft?.ownerName ?? ""}</td><td className="text-xs">{r.reason}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <form action={commitBridges.bind(null, id)}><ConfirmButton label={`Import ${preview.counts.create + preview.counts.update} bridges`} confirmLabel="Click again to save" /></form>
    </>
  );
}
