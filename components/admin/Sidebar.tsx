"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ListTodo,
  FileText,
  CalendarDays,
  IdCard,
  ScanLine,
  UserPlus,
  Package,
  Wallet,
  Users,
  HeartHandshake,
  ClipboardList,
  Map,
  CalendarCheck,
  Menu,
  X,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/roles";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Roles que ven el link. Si se omite, lo ve todo el equipo. */
  roles?: Role[];
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Operaciones",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/tareas", label: "Tareas", icon: ListTodo },
      { href: "/admin/actas", label: "Actas", icon: FileText },
      { href: "/admin/equipo", label: "Equipo", icon: Users, roles: ["socio"] },
    ],
  },
  {
    section: "Social Run",
    items: [
      { href: "/admin/eventos", label: "Eventos", icon: CalendarDays },
      { href: "/admin/planificaciones", label: "Planificaciones", icon: ClipboardList },
      { href: "/admin/rutas", label: "Rutas", icon: Map },
    ],
  },
  {
    section: "Membresía",
    items: [
      { href: "/admin/membresia", label: "Plan del mes", icon: CalendarCheck, roles: ["socio", "lider_comunidad"] },
      { href: "/admin/miembros", label: "Miembros", icon: IdCard, roles: ["socio", "lider_comunidad"] },
      { href: "/admin/escaneos", label: "Escaneos", icon: ScanLine, roles: ["socio", "lider_comunidad"] },
      { href: "/admin/convenios", label: "Convenios", icon: HeartHandshake, roles: ["socio", "lider_comunidad"] },
      { href: "/admin/leads", label: "Leads", icon: UserPlus, roles: ["socio", "lider_comunidad"] },
    ],
  },
  {
    section: "Recursos",
    items: [
      { href: "/admin/kits", label: "Kits e inventario", icon: Package },
      { href: "/admin/finanzas", label: "Finanzas", icon: Wallet, roles: ["socio"] },
    ],
  },
];

export function Sidebar({
  role,
  name,
  onSignOut,
}: {
  role: Role;
  name: string;
  onSignOut: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const nav = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto p-5">
      <div>
        <p className="font-heading text-xl font-extrabold tracking-tight text-white">STRIDE</p>
        <p className="text-[11px] uppercase tracking-widest text-white/35">Sistema interno</p>
      </div>

      <div className="flex-1 space-y-6">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.roles || i.roles.includes(role));
          if (items.length === 0) return null;

          return (
            <div key={group.section}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-white/30">
                {group.section}
              </p>
              <ul className="space-y-0.5">
                {items.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive(href) ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                        isActive(href)
                          ? "bg-stride-accent/15 font-medium text-stride-accent"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/5 pt-4">
        <p className="truncate text-sm font-medium text-white">{name}</p>
        <p className="text-xs text-white/40">{ROLE_LABELS[role]}</p>
        <div className="mt-3">{onSignOut}</div>
      </div>
    </nav>
  );

  return (
    <>
      {/* Móvil */}
      <div className="flex items-center justify-between border-b border-white/5 bg-stride-bg px-4 py-3 lg:hidden">
        <p className="font-heading text-lg font-extrabold text-white">STRIDE</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-white/5 bg-stride-bg">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="absolute right-3 top-3 rounded-lg p-2 text-white/60 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {nav}
          </div>
        </div>
      )}

      {/* Escritorio */}
      <aside className="hidden w-64 shrink-0 border-r border-white/5 bg-stride-bg lg:block">
        <div className="sticky top-0 h-dvh">{nav}</div>
      </aside>
    </>
  );
}
