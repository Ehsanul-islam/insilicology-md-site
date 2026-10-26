"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/simulations", label: "My simulations" },
  { href: "/dashboard/requests", label: "Requests" },
];

export function DashboardNav() {
  const path = usePathname();
  return (
    <nav className="md-subnav" aria-label="Dashboard">
      <div className="md-wrap">
        <ul>
          {LINKS.map((l) => {
            const here = l.exact ? path === l.href : path.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link href={l.href} aria-current={here ? "page" : undefined}>{l.label}</Link>
              </li>
            );
          })}
          <li><span title="Coming soon">My blogs (soon)</span></li>
        </ul>
      </div>
    </nav>
  );
}
