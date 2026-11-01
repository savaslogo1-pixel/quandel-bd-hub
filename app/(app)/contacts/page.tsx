import Link from "next/link";
import type { DecisionRole, Prisma } from "@prisma/client";
import { Empty, PageHeader, Strength } from "@/components/ui";
import { DECISION_ROLES, DECISION_ROLE_LABELS, PICKLISTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fmtDate, todayUTC } from "@/lib/format";
import { canEditAccounts } from "@/lib/permissions";
import { picklist } from "@/lib/picklists";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Contacts" };

type SP = { q?: string; role?: string; fn?: string; overdue?: string; mine?: string };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const today = todayUTC();
  const where: Prisma.ContactWhereInput = {};
  if (sp.q) where.OR = [{ name: { contains: sp.q } }, { title: { contains: sp.q } }, { email: { contains: sp.q } }, { org: { name: { contains: sp.q } } }];
  if (sp.role && DECISION_ROLES.includes(sp.role as DecisionRole)) where.decisionRole = sp.role as DecisionRole;
  if (sp.fn) where.function = sp.fn;
  if (sp.overdue) where.nextTouch = { lt: today };
  if (sp.mine) where.org = { relationshipOwnerId: user.id };
  const [contacts, fns] = await Promise.all([
    prisma.contact.findMany({ where, include: { org: { select: { id: true, name: true, state: true } } }, orderBy: [{ nextTouch: { sort: "asc", nulls: "last" } }, { name: "asc" }], take: 500 }),
    picklist(PICKLISTS.contactFunction),
  ]);
  const filtered = Object.values(sp).some(Boolean);
  return (
    <>
      <PageHeader title="Contacts" sub="Decision-makers and influencers at every owner. Sorted by next touch." actions={canEditAccounts(user.role) && <Link className="btn btn-primary" href="/contacts/new">Add contact</Link>} />
      <form className="filters" method="get">
        <input name="q" type="search" placeholder="Search name, title, email, organization" defaultValue={sp.q} />
        <select name="role" defaultValue={sp.role ?? ""}><option value="">All decision roles</option>{DECISION_ROLES.map((r) => <option key={r} value={r}>{DECISION_ROLE_LABELS[r]}</option>)}</select>
        <select name="fn" defaultValue={sp.fn ?? ""}><option value="">All functions</option>{fns.map((f) => <option key={f}>{f}</option>)}</select>
        <label className="check"><input type="checkbox" name="overdue" value="1" defaultChecked={!!sp.overdue} /> Overdue touch</label>
        <label className="check"><input type="checkbox" name="mine" value="1" defaultChecked={!!sp.mine} /> At orgs I own</label>
        <button className="btn btn-sm" type="submit">Apply</button>
        {filtered && <Link className="btn btn-sm" href="/contacts">Clear</Link>}
      </form>
      {contacts.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Organization</th><th>Decision role</th><th>Function</th><th>Strength</th><th>Last touch</th><th>Next touch</th></tr></thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td><Link className="rowlink" href={`/contacts/${c.id}`}>{c.name}</Link>{c.doNotContact && <span className="chip chip-bad ml-1">do not contact</span>}<div className="muted text-xs">{c.title}</div></td>
                  <td><Link href={`/organizations/${c.org.id}`}>{c.org.name}</Link> <span className="muted text-xs">{c.org.state}</span></td>
                  <td>{c.decisionRole ? DECISION_ROLE_LABELS[c.decisionRole] : "—"}</td>
                  <td className="text-xs">{c.function ?? "—"}</td>
                  <td><Strength n={c.relationshipStrength} /></td>
                  <td className="mono text-xs">{fmtDate(c.lastTouch)}</td>
                  <td>{c.nextTouch ? <span className={`chip ${c.nextTouch < today ? "chip-bad" : ""}`}>{fmtDate(c.nextTouch)}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={filtered ? "No contacts match" : "No contacts yet"}>{!filtered && "Add contacts from an organization's page."}</Empty>
      )}
    </>
  );
}
