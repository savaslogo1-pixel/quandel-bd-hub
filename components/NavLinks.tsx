"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** `exact`: a link that is only "current" on its own path (e.g. a section index). */
export function NavLinks({ links, exact = "/" }: { links: [string, string][]; exact?: string }) {
  const path = usePathname();
  return (
    <nav className="nav mt-1.5 flex gap-0.5 overflow-x-auto" aria-label="Main">
      {links.map(([href, label]) => {
        const on = href === exact ? path === href : path.startsWith(href);
        return <Link key={href} href={href} aria-current={on ? "page" : undefined}>{label}</Link>;
      })}
    </nav>
  );
}
