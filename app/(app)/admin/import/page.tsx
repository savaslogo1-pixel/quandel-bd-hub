import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { PRESETS } from "@/lib/import/presets";
import { canImport } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { uploadImport } from "./actions";

export const metadata = { title: "Imports" };

const STATUS = { DRAFT: ["Not saved yet", "chip-warn"], COMMITTED: ["Imported", "chip-ok"], UNDONE: ["Undone", ""] } as const;

export default async function ImportsPage() {
  const user = await requireUser();
  if (!canImport(user.role)) redirect("/organizations");
  const batches = await prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { createdBy: { select: { name: true, email: true } } } });
  return (
    <>
      <PageHeader title="Import organizations" sub="Upload an .xlsx or .csv. You'll pick the sheet, check which column is which, review a preview with duplicates flagged, and only then save." />
      <section className="panel mb-5">
        <ActionForm action={uploadImport} className="flex flex-wrap items-end gap-3" submitLabel="Upload and preview">
          <label className="field min-w-[280px] flex-1"><span>Workbook or CSV</span><input id="import-file" type="file" name="file" accept=".xlsx,.csv" /></label>
        </ActionForm>
        <p className="muted mt-2 text-xs">Saved column setups: {PRESETS.map((p) => p.label).join("; ")}. Other files get a best guess you can adjust.</p>
      </section>
      <h2 className="mb-2 text-lg">Past imports</h2>
      {batches.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>File</th><th>Status</th><th className="num">Rows</th><th className="num">New</th><th className="num">Updated</th><th className="num">Skipped</th><th className="num">Errors</th><th>By</th><th>When</th></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td><Link className="rowlink" href={`/admin/import/${b.id}`}>{b.fileName}</Link><div className="muted text-xs">{b.sheetName}</div></td>
                  <td><span className={`chip ${STATUS[b.status][1]}`}>{STATUS[b.status][0]}</span></td>
                  <td className="num">{b.rowCount}</td>
                  <td className="num">{b.status === "DRAFT" ? "" : b.created}</td>
                  <td className="num">{b.status === "DRAFT" ? "" : b.updated}</td>
                  <td className="num">{b.status === "DRAFT" ? "" : b.skipped}</td>
                  <td className="num">{b.status === "DRAFT" ? "" : b.errors}</td>
                  <td>{b.createdBy?.name ?? b.createdBy?.email ?? "—"}</td>
                  <td className="mono text-xs">{fmtDate(b.committedAt ?? b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="No imports yet" />}
    </>
  );
}
