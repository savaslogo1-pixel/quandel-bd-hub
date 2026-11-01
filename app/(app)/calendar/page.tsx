import Link from "next/link";
import { CompanyTag, Empty, PageHeader } from "@/components/ui";
import { CAL_TYPES, calendarEvents, type CalType } from "@/lib/calendar";
import { todayUTC } from "@/lib/format";
import { addDays } from "@/lib/meetings";
import { companies as loadCompanies } from "@/lib/picklists";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Calendar" };

type SP = { hide?: string; co?: string; mine?: string; months?: string };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const today = todayUTC();
  const months = Math.min(12, Math.max(1, Number(sp.months) || 6));
  const from = addDays(today, -14);
  const to = addDays(today, months * 31);
  const hide = new Set((sp.hide ?? "").split(",").filter(Boolean));
  const [all, cos] = await Promise.all([calendarEvents(from, to, { userId: sp.mine ? user.id : undefined }), loadCompanies()]);
  const events = all.filter((e) => !hide.has(e.type) && (!sp.co || e.companies.includes(sp.co)));
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return s ? `/calendar?${s}` : "/calendar";
  };
  const toggle = (t: CalType) => {
    const n = new Set(hide);
    if (n.has(t)) n.delete(t); else n.add(t);
    return qs({ hide: [...n].join(",") || undefined });
  };
  const byDay = new Map<string, typeof events>();
  for (const e of events) {
    const k = e.date.toISOString().slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  let lastMonth = "";
  return (
    <>
      <PageHeader
        title="Calendar"
        sub={`Grant deadlines, bid dates, board meetings, approval steps and next steps in one list: two weeks back, ${months} months ahead. Board meetings show for Tier A organizations and organizations with open opportunities.`}
      />
      <div className="filters">
        {(Object.keys(CAL_TYPES) as CalType[]).map((t) => (
          <Link key={t} href={toggle(t)} className="btn btn-sm" aria-pressed={!hide.has(t)} style={hide.has(t) ? { opacity: 0.5 } : undefined}>
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CAL_TYPES[t].color }} />{CAL_TYPES[t].label}
          </Link>
        ))}
      </div>
      <form className="filters" method="get">
        {sp.hide && <input type="hidden" name="hide" value={sp.hide} />}
        <select name="co" defaultValue={sp.co ?? ""}><option value="">All companies</option>{cos.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select>
        <select name="months" defaultValue={String(months)}>{[3, 6, 12].map((m) => <option key={m} value={m}>{m} months ahead</option>)}</select>
        <label className="check"><input type="checkbox" name="mine" value="1" defaultChecked={!!sp.mine} /> Mine only</label>
        <button className="btn btn-sm">Apply</button>
      </form>
      {byDay.size ? (
        <div className="panel">
          {[...byDay.entries()].map(([day, list]) => {
            const d = new Date(day + "T00:00:00Z");
            const month = d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
            const head = month !== lastMonth;
            lastMonth = month;
            const isToday = day === today.toISOString().slice(0, 10);
            return (
              <div key={day}>
                {head && <h2 className="mb-1 mt-4 text-lg first:mt-0">{month}</h2>}
                <div className="grid grid-cols-[84px_1fr] gap-3 border-t py-2" style={{ borderColor: "var(--line)" }}>
                  <div className="mono text-xs" style={{ color: "var(--muted)" }}>
                    <b className="block font-[family-name:var(--font-display)] text-lg font-medium" style={{ color: isToday ? "var(--brand)" : "var(--ink)" }}>{d.getUTCDate()}{isToday && " · today"}</b>
                    {d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}{d < today && " · past"}
                  </div>
                  <ul className="flex flex-col gap-1">
                    {list.map((e, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: CAL_TYPES[e.type].color }}>{CAL_TYPES[e.type].label}</span>
                        <Link href={e.href} className="font-semibold">{e.title}</Link>
                        <span className="muted text-xs">{e.sub}</span>
                        {e.companies.slice(0, 3).map((c) => <CompanyTag key={c} code={c} />)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      ) : <Empty title="Nothing on the calendar">Add program deadlines, key dates on opportunities, approval steps or a meeting pattern on Tier A organizations.</Empty>}
    </>
  );
}
