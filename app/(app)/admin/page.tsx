import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { PageHeader } from "@/components/ui";
import { PICKLISTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { ROLE_LABELS, isAdmin } from "@/lib/permissions";
import { companies as loadCompanies } from "@/lib/picklists";
import { requireUser } from "@/lib/session";
import { addPicklistValue, togglePicklistValue, updateUser } from "./actions";

export const metadata = { title: "Admin" };

const LIST_LABELS: Record<string, string> = {
  [PICKLISTS.orgType]: "Organization types",
  [PICKLISTS.contactFunction]: "Contact functions",
  [PICKLISTS.activityType]: "Activity types",
  [PICKLISTS.preferredChannel]: "Preferred channels",
};

export default async function AdminPage() {
  const me = await requireUser();
  if (!isAdmin(me.role)) redirect("/");
  const [users, cos, values] = await Promise.all([
    prisma.user.findMany({ include: { companies: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    loadCompanies(),
    prisma.picklistValue.findMany({ orderBy: [{ list: "asc" }, { sortOrder: "asc" }] }),
  ]);
  return (
    <>
      <PageHeader title="Admin" sub="People, roles, company tags and dropdown lists. New people start as Trainee the first time they sign in." actions={<a className="btn" href="/admin/import">Import organizations</a>} />
      <h2 className="mb-2 text-lg">People</h2>
      <div className="mb-8 flex flex-col gap-3">
        {users.map((u) => (
          <div key={u.id} className="panel">
            <div className="mb-1 flex flex-wrap items-baseline gap-2">
              <b>{u.email}</b>
              {u.id === me.id && <span className="chip chip-brand">you</span>}
              {!u.active && <span className="chip chip-bad">deactivated</span>}
            </div>
            <ActionForm action={updateUser.bind(null, u.id)} className="form cols-3" submitLabel="Save">
              <label className="field"><span>Name</span><input name="name" defaultValue={u.name ?? ""} /></label>
              <label className="field">
                <span>Role</span>
                <select name="role" defaultValue={u.role}>{Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </label>
              <label className="check self-end"><input type="checkbox" name="active" defaultChecked={u.active} /> Active (can sign in)</label>
              <fieldset className="field full">
                <legend>Companies</legend>
                <div className="checks">
                  {cos.map((c) => <label key={c.id}><input type="checkbox" name="companies" value={c.id} defaultChecked={u.companies.some((x) => x.id === c.id)} /> {c.code} · {c.name}</label>)}
                </div>
              </fieldset>
            </ActionForm>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-lg">Dropdown lists</h2>
      <p className="muted mb-3">Turning a value off hides it from new entries; records that already use it keep it.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(LIST_LABELS).map(([list, label]) => (
          <section key={list} className="panel">
            <h3 className="mb-2 text-base">{label}</h3>
            <ul className="rows mb-2">
              {values.filter((v) => v.list === list).map((v) => (
                <li key={v.id}>
                  <span className={v.active ? "" : "muted line-through"}>{v.label}</span>
                  <form action={togglePicklistValue.bind(null, v.id)}><button className="btn btn-sm">{v.active ? "Turn off" : "Turn on"}</button></form>
                </li>
              ))}
            </ul>
            <ActionForm action={addPicklistValue.bind(null, list)} className="flex" submitLabel="Add">
              <label className="field flex-1"><span>New value</span><input name="value" /></label>
            </ActionForm>
          </section>
        ))}
      </div>
    </>
  );
}
