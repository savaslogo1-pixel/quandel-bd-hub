import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Empty, PageHeader } from "@/components/ui";
import { STATES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { canFacilitate } from "@/lib/permissions";
import { checklistFor, DELIVERY_METHODS, deliveryLabel } from "@/lib/pipeline";
import { requireUser } from "@/lib/session";
import { addLibraryItem, deleteLibraryItem } from "../actions";

export const metadata = { title: "Reference library" };

const KINDS: Record<string, string> = {
  glossary: "Glossary", cheat_sheet: "Program cheat sheets", playbook: "Playbooks", guide: "Board-meeting reading guides and sample agendas", ma_card: "OK to say / not OK to say (municipal advisor)",
};

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string; st?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const items = await prisma.libraryItem.findMany({
    where: {
      ...(sp.kind ? { kind: sp.kind } : {}),
      ...(sp.q ? { OR: [{ title: { contains: sp.q } }, { body: { contains: sp.q } }] } : {}),
      ...(sp.st ? { states: { contains: sp.st } } : {}),
    },
    orderBy: [{ kind: "asc" }, { title: "asc" }],
  });
  const fac = canFacilitate(user.role);
  return (
    <>
      <PageHeader title="Reference library" sub="Glossary, program cheat sheets, delivery-method playbooks, board-meeting guides and municipal-advisor cards, tagged by state. Facilitators add entries; deck content stays in the decks." />
      <form className="filters" method="get">
        <input type="search" name="q" placeholder="Search" defaultValue={sp.q} />
        <select name="kind" defaultValue={sp.kind ?? ""}><option value="">Everything</option>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="st" defaultValue={sp.st ?? ""}><option value="">All states</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn btn-sm">Search</button>
      </form>
      {items.length ? (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {items.map((i) => (
            <article key={i.id} className="panel">
              <div className="eyebrow">{KINDS[i.kind] ?? i.kind}{i.states ? ` · ${i.states.replace(/,/g, ", ")}` : ""}</div>
              <h2 className="text-base">{i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer">{i.title}</a> : i.title}</h2>
              {i.body && <p className="mt-1 whitespace-pre-wrap text-[13px]">{i.body}</p>}
              {fac && <form action={deleteLibraryItem.bind(null, i.id)} className="mt-2"><button className="btn btn-sm btn-danger">Remove</button></form>}
            </article>
          ))}
        </div>
      ) : <div className="mb-6"><Empty title={sp.q || sp.kind || sp.st ? "Nothing matches" : "The library is empty"}>{fac ? "Add the first entry below." : "Facilitators add entries here."}</Empty></div>}

      <h2 className="mb-1 text-lg">Delivery-method playbooks: checklists</h2>
      <p className="muted mb-2 text-sm">The short form of each playbook, from the pipeline checklists. Long-form playbooks go in the library above.</p>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {[...new Map(DELIVERY_METHODS.map((m) => [checklistFor(m)?.title, m])).values()].filter((m) => checklistFor(m)).map((m) => (
          <div key={m} className="panel">
            <b>{checklistFor(m)!.title}</b>
            <ol className="mt-1 list-decimal pl-5 text-[13px]">{checklistFor(m)!.items.map((i) => <li key={i.key}>{i.label}</li>)}</ol>
            <div className="muted mt-1 text-xs">{DELIVERY_METHODS.filter((x) => checklistFor(x)?.title === checklistFor(m)!.title).map(deliveryLabel).join("; ")}</div>
          </div>
        ))}
      </div>
      <p className="muted text-sm">Program cheat sheets can also lean on the <Link href="/programs">funding program library</Link>; state thresholds are on <Link href="/rules">State rules</Link>.</p>

      {fac && (
        <section className="panel mt-6">
          <h2 className="mb-2 text-lg">Add an entry</h2>
          <ActionForm action={addLibraryItem} className="form cols-3" submitLabel="Add">
            <label className="field"><span>Kind</span><select name="kind">{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="field"><span>Title or term</span><input name="title" /></label>
            <label className="field"><span>Link <span className="hint">optional</span></span><input name="url" placeholder="https://" /></label>
            <label className="field full"><span>Text</span><textarea name="body" /></label>
            <fieldset className="field full"><legend>States</legend><div className="checks">{STATES.map((s) => <label key={s}><input type="checkbox" name="states" value={s} /> {s}</label>)}</div></fieldset>
          </ActionForm>
        </section>
      )}
    </>
  );
}
