import { ActionForm } from "@/components/ActionForm";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { addDays } from "@/lib/meetings";
import { fmtDate, ymd } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { NINETY_DAYS } from "@/lib/training/logic";
import { startNinetyDays, toggleNinety } from "../actions";

export const metadata = { title: "First 90 days" };

export default async function NinetyPage() {
  const user = await requireUser();
  const plan = await prisma.ninetyDayPlan.findUnique({ where: { userId: user.id } });
  const checks = plan ? (JSON.parse(plan.checks) as Record<string, string>) : {};
  // Live counts from the CRM so the plan reflects real work.
  const [ownedOrgs, ownedWithPattern, meetings, stackRows, openOpps] = await Promise.all([
    prisma.organization.count({ where: { relationshipOwnerId: user.id } }),
    prisma.organization.count({ where: { relationshipOwnerId: user.id, meetingWeekday: { not: null } } }),
    prisma.activity.count({ where: { createdById: user.id, type: "meeting" } }),
    prisma.capitalStackRow.count({ where: { programId: { not: null }, opportunity: { OR: [{ ownerId: user.id }, { createdById: user.id }] } } }),
    prisma.opportunity.count({ where: { ownerId: user.id, stage: { lt: 9 } } }),
  ]);
  const auto: Record<string, number> = { ownedOrgs, ownedOrgsWithPattern: ownedWithPattern, meetingActivities: meetings, stackRowsOnOwnedOpps: stackRows, ownedOpenOpps: openOpps };
  const phases = [...new Set(NINETY_DAYS.map((i) => i.phase))];
  return (
    <>
      <PageHeader title="First 90 days" sub="For new BD leads: targets, meeting calendars and minutes in the first 30 days; meetings and program matching by 60; two live pursuit plans and one grant package by 90. Counts come from your work in the CRM; tick each item when it's truly done." />
      <section className="panel mb-4">
        <ActionForm action={startNinetyDays} className="flex flex-wrap items-end gap-3" submitLabel={plan ? "Change start date" : "Start my plan"}>
          <label className="field"><span>Start date</span><input type="date" name="startDate" defaultValue={plan ? ymd(plan.startDate) : new Date().toISOString().slice(0, 10)} /></label>
        </ActionForm>
      </section>
      {plan && (
        <div className="grid gap-4 md:grid-cols-3">
          {phases.map((ph) => {
            const days = Number(ph.split(" ")[0]);
            return (
              <section key={ph} className="panel">
                <h2 className="text-lg">By day {days}</h2>
                <p className="muted mb-2 text-xs">{fmtDate(addDays(plan.startDate, days))}</p>
                <ul className="flex flex-col gap-2">
                  {NINETY_DAYS.filter((i) => i.phase === ph).map((i) => {
                    const n = i.auto ? auto[i.auto] ?? 0 : null;
                    return (
                      <li key={i.key} className="flex items-start gap-2">
                        <form action={toggleNinety.bind(null, i.key)}><button className="btn btn-sm" aria-pressed={!!checks[i.key]} aria-label={`${checks[i.key] ? "Undo" : "Done"}: ${i.label}`}>{checks[i.key] ? "✓" : "○"}</button></form>
                        <div className="min-w-0 flex-1" style={checks[i.key] ? { color: "var(--muted)" } : undefined}>
                          {i.label}
                          {n != null && <div className="text-xs"><span className={`chip ${n >= (i.goal ?? 1) ? "chip-ok" : ""}`}>{n}{i.goal ? ` of ${i.goal}` : ""} in the CRM</span></div>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
