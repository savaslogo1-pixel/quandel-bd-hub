import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { PageHeader } from "@/components/ui";
import { canImport } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { uploadBridges } from "../actions";

export const metadata = { title: "Import bridges" };

export default async function ImportBridges() {
  const user = await requireUser();
  if (!canImport(user.role)) redirect("/bridges");
  return (
    <>
      <PageHeader title="Import a bridge list" sub="An NBI extract or a county list as .xlsx or .csv. Columns are matched by name (bridge, county, year built, vehicles/day, owner, route type…). You'll see a preview before anything is saved." />
      <section className="panel">
        <ActionForm action={uploadBridges} className="flex flex-wrap items-end gap-3" submitLabel="Upload and preview">
          <label className="field min-w-[280px] flex-1"><span>Workbook or CSV</span><input id="bridge-file" type="file" name="file" accept=".xlsx,.csv" /></label>
        </ActionForm>
      </section>
    </>
  );
}
