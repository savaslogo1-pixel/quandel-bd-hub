/** Download a table as CSV or Excel (SPEC §11: export any table). */
export function ExportLinks({ table, query }: { table: string; query?: string }) {
  const q = query ? `&${query}` : "";
  return (
    <span className="inline-flex items-center gap-1">
      <span className="muted text-xs">Export</span>
      <a className="btn btn-sm" href={`/api/export/${table}?format=csv${q}`}>CSV</a>
      <a className="btn btn-sm" href={`/api/export/${table}?format=xlsx${q}`}>Excel</a>
    </span>
  );
}
