"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, ListTodo, FileText, CalendarDays, IdCard, ScanLine, UserPlus,
  Package, Wallet, Users, HeartHandshake, ClipboardList, Map, CalendarCheck,
  MessageSquareQuote, ClipboardCheck, ShieldCheck, Settings, Menu, X, UserRound, HardDrive, BarChart3, BookLock, Gauge,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/lib/types";

// El servidor decide QUÉ módulos van (permisos por rol + configuración);
// acá solo se les pone icono y se dibujan.
const ICONS: Record<string, typeof LayoutDashboard> = {
  "/admin": LayoutDashboard,
  "/admin/tareas": ListTodo,
  "/admin/actas": FileText,
  "/admin/eventos": CalendarDays,
  "/admin/planificaciones": ClipboardList,
  "/admin/rutas": Map,
  "/admin/evaluaciones": ClipboardCheck,
  "/admin/metricas": BarChart3,
  "/admin/membresia": CalendarCheck,
  "/admin/miembros": IdCard,
  "/admin/escaneos": ScanLine,
  "/admin/convenios": HeartHandshake,
  "/admin/leads": UserPlus,
  "/admin/testimonios": MessageSquareQuote,
  "/admin/documentos": HardDrive,
  "/admin/kits": Package,
  "/admin/finanzas": Wallet,
  "/admin/equipo": Users,
  "/admin/desempeno": Gauge,
  "/admin/incumplimientos": BookLock,
  "/admin/configuracion": Settings,
  "/admin/seguridad": ShieldCheck,
};

export interface SidebarGroup {
  section: string;
  items: Array<{ href: string; label: string }>;
}

function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="block shrink-0 rounded-full border-2 border-white/70"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 30% 24%, #ffffff 0%, #7ef4ff 8%, #00e5ff 25%, #6366f1 58%, #7c3aed 82%, #32106e 100%)",
        boxShadow: "0 0 8px rgba(0,229,255,.6), 0 0 12px rgba(124,58,237,.5)",
      }}
    />
  );
}

export function Sidebar({
  role,
  name,
  photoUrl,
  groups,
  onSignOut,
}: {
  role: Role;
  name: string;
  photoUrl: string | null;
  groups: SidebarGroup[];
  onSignOut: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const nav = (expanded: boolean) => (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto overflow-x-hidden px-3 py-5">
      {/* Marca: esfera siempre; wordmark solo desplegado */}
      <Link href="/admin" className="flex h-10 items-center gap-3 px-1.5">
        <BrandMark />
        <span className={`min-w-0 transition-opacity duration-150 ${expanded ? "opacity-100" : "opacity-0"}`}>
          <Image src="/stride_logo_clean.png" alt="STRIDE" width={92} height={26} className="h-6 w-auto" />
          <span className="block text-[10px] uppercase tracking-[0.2em] text-white/35">Sistema interno</span>
        </span>
      </Link>

      <div className="flex-1 space-y-5">
        {groups.map((group) => (
          <div key={group.section}>
            <p className={`mb-1.5 h-4 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/30 transition-opacity duration-150 ${expanded ? "opacity-100" : "opacity-0"}`}>
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label }) => {
                const Icon = ICONS[href] ?? LayoutDashboard;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      title={label}
                      aria-current={isActive(href) ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition ${
                        isActive(href)
                          ? "bg-stride-accent/15 font-medium text-stride-accent"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className={`whitespace-nowrap transition-opacity duration-150 ${expanded ? "opacity-100" : "opacity-0"}`}>
                        {label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 pt-4">
        <div className="flex items-center gap-3 px-1">
          {photoUrl ? (
            <Image src={photoUrl} alt={name} width={36} height={36} unoptimized className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <UserRound className="h-4 w-4 text-white/40" />
            </span>
          )}
          <div className={`min-w-0 transition-opacity duration-150 ${expanded ? "opacity-100" : "opacity-0"}`}>
            <p className="truncate text-sm font-medium text-white">{name}</p>
            <p className="text-xs text-white/40">{ROLE_LABELS[role]}</p>
          </div>
        </div>
        <div className={`mt-3 transition-opacity duration-150 ${expanded ? "opacity-100" : "opacity-0"}`}>{onSignOut}</div>
      </div>
    </nav>
  );

  return (
    <>
      {/* Móvil: barra superior + panel */}
      <div className="flex items-center justify-between border-b border-white/5 bg-stride-bg px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <Image src="/stride_logo_clean.png" alt="STRIDE" width={84} height={24} className="h-5 w-auto" />
        </Link>
        <button type="button" onClick={() => setOpen(!open)} aria-label="Menú" className="rounded-lg border border-white/10 p-2 text-white/70">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-b border-white/5 bg-stride-bg lg:hidden">{nav(true)}</div>
      )}

      {/* Escritorio: riel plegado, pegado a la ventana, que se expande al pasar el mouse */}
      <aside className="hidden w-[72px] shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <div className="group absolute inset-y-0 left-0 z-40 w-[72px] overflow-hidden border-r border-white/5 bg-stride-bg transition-[width] duration-200 ease-out hover:w-64 hover:shadow-[8px_0_24px_rgba(0,0,0,.45)]">
            <div className="hidden h-full w-64 group-hover:block">{nav(true)}</div>
            <div className="h-full w-[72px] group-hover:hidden">{nav(false)}</div>
          </div>
        </div>
      </aside>
    </>
  );
}
