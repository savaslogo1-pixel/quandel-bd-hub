import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageHeader } from "@/components/ui";
import { ORG_STATUS_LABELS, PICKLISTS, STATES, TIERS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { ORG_FIELDS, type PreviewRow } from "@/lib/import/orgs";
import { PRESETS } from "@/lib/import/presets";
import { parsed, previewFor } from "@/lib/import/run";
import { canImport } from "@/lib/permissions";
import { companies as loadCompanies, picklist } from "@/lib/picklists";
import { requireUser } from "@/lib/session";
import { chooseSheet, commitImport, discardImport, resolveRow, saveMapping, undoImport } from "../actions";

export const metadata = { title: "Import preview" };

const ACTION: Record<PreviewRow["action"] | "review", [string, string]> = {
  create: ["New", "chip-ok"], update: ["Update", "chip-brand"], skip: ["Skip", ""], error: ["Error", "chip-bad"], review: ["Check", "chip-warn"],
};

export default async function ImportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ show?: string; undone?: string; kept?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  if (!canImport(user.role)) redirect("/organizations");
  const b = await prisma.importBatch.findUnique({ where: { id } });
  if (!b) notFound();
  const { headers, rows, sheets, mapping, defaults } = parsed(b);
  const draft = b.status === "DRAFT";
  const preset = PRESETS.find((p) => p.id === defaults.presetId);
  const [types, cos] = await Promise.all([picklist(PICKLISTS.orgType), loadCompanies()]);

  if (!draft) {
    const created = await prisma.organization.count({ where: { importBatchId: id } });
    return (
      <>
        <PageHeader title={b.fileName} sub={`${b.sheetName ?? ""} · imported ${fmtDate(b.committedAt)}`} actions={<Link className="btn" href="/admin/import">All imports</Link>} />
        {sp.undone && <p className="banner banner-info">Undone: removed {sp.undone} organizations this import created. {Number(sp.kept) > 0 && `${sp.kept} were kept because people had already added contacts, activities or opportunities.`} Updates to existing organizations were not reversed.</p>}
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Count n={b.created} label={b.status === "UNDONE" ? "Created and still in the CRM" : "New organizations"} />
          <Count n={b.updated} label="Existing organizations updated" />
          <Count n={b.skipped} label="Rows skipped" />
          <Count n={b.errors} label="Rows with errors (not imported)" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-primary" href={`/organizations?q=`}>View organizations</Link>
          {b.status === "COMMITTED" && created > 0 && (
            <form action={undoImport.bind(null, id)}><ConfirmButton label="Undo this import" confirmLabel={`Click again: removes up to ${created} organizations it created`} /></form>
          )}
        </div>
      </>
    );
  }

  const preview = await previewFor(b);
  const review = preview.rows.filter((r) => r.possible).length;
  const show = sp.show ?? "all";
  const list = preview.rows.filter((r) => show === "all" || (show === "review" ? !!r.possible : r.action === show));
  const sample = (i: number) => rows.find((r) => r[i])?.[i] ?? "";
  const colOptions = headers.map((h, i) => [String(i), `${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""} · ${h}`]);

  return (
    <>
      <PageHeader title={b.fileName} sub={`${b.rowCount} data rows${b.sheetName && b.sheetName !== "CSV" ? ` on the "${b.sheetName}" sheet` : ""}. Nothing is saved until you click Import.`} actions={<form action={discardImport.bind(null, id)}><ConfirmButton label="Discard" confirmLabel="Click again to discard" /></form>} />
      {preset && <p className="banner banner-info">Recognized this file and applied the saved setup: <b>{preset.label}</b>. {preset.notes}</p>}

      <section className="panel mb-4">
        <h2 className="mb-2 text-lg">1. Sheet</h2>
        <ActionForm action={chooseSheet.bind(null, id)} className="flex flex-wrap items-end gap-3" submitLabel="Re-read">
          <label className="field"><span>Sheet</span><select name="sheet" defaultValue={b.sheetName ?? ""}>{sheets.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field" style={{ width: 130 }}><span>Header row</span><input name="headerRow" inputMode="numeric" defaultValue={b.headerRow} /></label>
        </ActionForm>
        <p className="muted mt-1 text-xs">Changing the sheet or header row re-reads the file and resets the column choices below.</p>
      </section>

      <section className="panel mb-4">
        <h2 className="mb-2 text-lg">2. Columns and defaults</h2>
        <ActionForm action={saveMapping.bind(null, id)} className="form cols-3" submitLabel="Update preview">
          {ORG_FIELDS.map((f) => {
            const c = mapping[f.key];
            return (
              <label key={f.key} className="field">
                <span>{f.label}{f.required && " *"} {typeof c === "number" && <span className="hint">e.g. “{sample(c).slice(0, 40)}”</span>}</span>
                <select name={`map_${f.key}`} defaultValue={typeof c === "number" ? String(c) : ""}>
                  <option value="">— not in this file —</option>
                  {colOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            );
          })}
          <fieldset className="field full">
            <legend>Add these columns to each organization's Notes</legend>
            <div className="checks">{headers.map((h, i) => <label key={i}><input type="checkbox" name="notes" value={i} defaultChecked={(mapping.notes ?? []).includes(i)} /> {h}</label>)}</div>
          </fieldset>
          <div className="sect">Defaults for rows that don't say</div>
          <label className="field"><span>State</span><select name="state" defaultValue={defaults.state ?? ""}><option value="">— required in file —</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field"><span>Type <span className="hint">if not in the file or the name</span></span><select name="orgType" defaultValue={defaults.orgType ?? ""}><option value="">—</option>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="check"><input type="checkbox" name="inferType" defaultChecked={defaults.inferType !== false} /> Work out the type from the name when needed</label>
          <label className="field"><span>Tier</span><select name="tier" defaultValue={defaults.tier ?? ""}><option value="">—</option>{TIERS.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="field"><span>Status</span><select name="status" defaultValue={defaults.status ?? ""}><option value="">Target</option>{Object.entries(ORG_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="field"><span>Source label</span><input name="source" defaultValue={defaults.source ?? ""} /></label>
          <fieldset className="field"><legend>Company tags on every row</legend><div className="checks">{cos.map((c) => <label key={c.code}><input type="checkbox" name="companyCodes" value={c.code} defaultChecked={(defaults.companyCodes ?? []).includes(c.code)} /> {c.code}</label>)}</div></fieldset>
          <fieldset className="field"><legend>Company tags only on rows with a tier</legend><div className="checks">{cos.map((c) => <label key={c.code}><input type="checkbox" name="companyCodesWhenTier" value={c.code} defaultChecked={(defaults.companyCodesWhenTier ?? []).includes(c.code)} /> {c.code}</label>)}</div></fieldset>
          <label className="field"><span>When an organization is already in the CRM</span>
            <select name="onDuplicate" defaultValue={defaults.onDuplicate ?? "fill"}>
              <option value="fill">Fill in blank fields only (recommended)</option>
              <option value="overwrite">Replace with the file's values</option>
              <option value="skip">Skip it</option>
            </select>
          </label>
        </ActionForm>
      </section>

      <section className="mb-4">
        <h2 className="mb-1 text-lg">3. Preview</h2>
        <p className="muted mb-2 text-sm">Duplicates are matched on name + state + type + county. Similar names in the same county (e.g. “IU 29” and “Intermediate Unit 29”) count as the same organization; similar names in a different county are listed under Check for you to decide.</p>
        <nav className="filters" aria-label="Show rows">
          {(["all", "create", "update", "review", "skip", "error"] as const).map((k) => {
            const n = k === "all" ? preview.rows.length : k === "review" ? review : preview.counts[k];
            return <Link key={k} href={`/admin/import/${id}?show=${k}`} className={`btn btn-sm ${show === k ? "btn-primary" : ""}`}>{k === "all" ? "All" : ACTION[k][0]} · {n}</Link>;
          })}
        </nav>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th className="num">Row</th><th>Result</th><th>Name</th><th>Type</th><th>County</th><th>Tier</th><th>Tags</th><th>Details</th></tr></thead>
            <tbody>
              {list.slice(0, 300).map((r) => {
                const [label, cls] = r.possible ? ACTION.review : ACTION[r.action];
                return (
                  <tr key={r.line}>
                    <td className="num">{r.line}</td>
                    <td><span className={`chip ${cls}`}>{label}</span></td>
                    <td>{r.draft.name || <span className="muted">—</span>}{r.matchName && r.matchName !== r.draft.name && <div className="muted text-xs">→ {r.matchName}</div>}</td>
                    <td className="text-xs">{r.draft.orgType ?? ""}</td>
                    <td>{r.draft.county ?? ""}</td>
                    <td>{r.draft.tier ?? ""}</td>
                    <td className="text-xs">{(r.draft.companyCodes ?? []).join(" ")}</td>
                    <td className="text-xs">
                      {r.errors.map((e) => <div key={e} style={{ color: "var(--bad)" }}>{e}</div>)}
                      {r.reason && <div>{r.reason}</div>}
                      {r.changes && <div>Adds: {r.changes.join(", ")}</div>}
                      {r.notes.map((n) => <div key={n} className="muted">{n}</div>)}
                      {r.possible && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span>Similar to <b>{r.possible.name}</b> ({r.possible.county ?? "no county"} County).</span>
                          <form action={resolveRow.bind(null, id, r.line, r.possible.id)}><button className="btn btn-sm">Same organization</button></form>
                          <form action={resolveRow.bind(null, id, r.line, "new")}><button className="btn btn-sm">Different, add it</button></form>
                        </div>
                      )}
                      {r.matchedBy === "person" && <div className="muted">You marked this as the same organization.</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length > 300 && <p className="muted mt-1 text-xs">Showing the first 300 of {list.length}. Use the filters to see others.</p>}
      </section>

      <section className="panel flex flex-wrap items-center gap-3" style={{ borderColor: "var(--brand)" }}>
        <div className="min-w-0 flex-1">
          <b>Ready to import?</b> {preview.counts.create} new, {preview.counts.update} updated, {preview.counts.skip} skipped{preview.counts.error ? `, ${preview.counts.error} with errors (left out)` : ""}.
          {review > 0 && <span style={{ color: "var(--warn)" }}> {review} row{review === 1 ? "" : "s"} still marked Check will be added as new unless you decide.</span>}
        </div>
        <form action={commitImport.bind(null, id)}><ConfirmButton label={`Import ${preview.counts.create + preview.counts.update} rows`} confirmLabel="Click again to save to the CRM" /></form>
      </section>
    </>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <div className="panel">
      <b className="block font-[family-name:var(--font-display)] text-[28px] font-semibold leading-tight">{n.toLocaleString("en-US")}</b>
      <span className="muted text-[12.5px]">{label}</span>
    </div>
  );
}
