import Image from "next/image";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { SignOut } from "@/components/SignOut";
import { CompanyTags } from "@/components/ui";
import { ROLE_LABELS, isAdmin } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { generateDeadlineAlerts } from "@/lib/alerts";
import { prisma } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await generateDeadlineAlerts(user.id);
  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
  const links: [string, string][] = [
    ["/", "Home"],
    ["/dashboard", "Dashboard"],
    ["/pipeline", "Pipeline"],
    ["/organizations", "Organizations"],
    ["/programs", "Programs"],
    ["/projects", "Projects"],
    ["/bridges", "Bridges"],
    ["/competitors", "Competitors"],
    ["/calendar", "Calendar"],
    ["/training", "Training"],
    ["/contacts", "Contacts"],
    ["/activities", "Activities"],
  ];
  links.push(["/compliance", "Compliance"], ["/rules", "State rules"]);
  if (isAdmin(user.role)) links.push(["/admin", "Admin"]);
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <div className="flex flex-wrap items-center gap-3 pt-2.5">
            <Link href="/" className="flex items-center gap-3 text-[var(--ink)] no-underline">
              <span className="rounded-md bg-white px-2 py-1 shadow-[0_0_0_1px_var(--line)]">
                <Image src="/quandel-logo.png" alt="Quandel Enterprises" width={110} height={41} style={{ height: 28, width: "auto" }} priority />
              </span>
              <span>
                <span className="block font-[family-name:var(--font-display)] text-[20px] uppercase leading-none tracking-wider">BD Hub</span>
                <span className="eyebrow hidden sm:block">Projects · Partners · Programs</span>
              </span>
            </Link>
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-[12.5px]">
              <Link href="/alerts" className={`chip ${unread ? "chip-bad" : ""}`} title="Deadline alerts">{unread ? `${unread} alert${unread === 1 ? "" : "s"}` : "Alerts"}</Link>
              <span className="muted">{user.name ?? user.email}</span>
              <span className="chip">{ROLE_LABELS[user.role]}</span>
              {user.companies.length > 0 && <CompanyTags codes={user.companies} />}
              <SignOut />
            </div>
          </div>
          <NavLinks links={links} />
        </div>
      </header>
      <main className="wrap pb-16 pt-5">{children}</main>
    </>
  );
}
