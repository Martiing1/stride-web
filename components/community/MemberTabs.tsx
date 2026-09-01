"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS = [
  { href: "/miembros", label: "Blog" },
  { href: "/miembros/classroom", label: "Classroom" },
  { href: "/miembros/calendario", label: "Calendario" },
  { href: "/miembros/retos", label: "Retos" },
  { href: "/miembros/ranking", label: "Ranking" },
  { href: "/miembros/perfil", label: "Perfil" },
];

export function MemberTabs() {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-none -mx-1 flex gap-6 overflow-x-auto px-1 pt-2">
      {TABS.map((tab) => {
        const active = tab.href === "/miembros" ? pathname === "/miembros" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "relative flex-none whitespace-nowrap pb-3 pt-1 font-heading text-sm font-semibold transition-colors",
              active ? "text-[var(--stext)]" : "text-[var(--sdim)] hover:text-[var(--smut)]"
            )}
          >
            {tab.label}
            {active && <span className="gradient-surface absolute inset-x-0 bottom-0 h-[2.5px] rounded-full" />}
          </Link>
        );
      })}
    </nav>
  );
}
