"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: [string, string][] }) {
  const path = usePathname();
  return (
    <nav className="nav mt-1.5 flex gap-0.5 overflow-x-auto" aria-label="Main">
      {links.map(([href, label]) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        return <Link key={href} href={href} aria-current={on ? "page" : undefined}>{label}</Link>;
      })}
    </nav>
  );
}
