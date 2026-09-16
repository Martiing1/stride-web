"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, GraduationCap } from "lucide-react";
import clsx from "clsx";

/**
 * Barra del staff dentro del área de miembros: identifica la vista de admin
 * y da acceso directo a la gestión (que vive en el ERP, mismo login).
 */
/** `pending`: cosas esperando en la cola de verificación (evidencias, medallas físicas, pausas). */
export function AdminBar({ name, pending = 0 }: { name: string; pending?: number }) {
  const pathname = usePathname();
  return (
    <div className="border-b border-stride-accent/25 bg-[var(--ssoft)] px-4 py-2 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="flex flex-none items-center gap-1.5 rounded-full bg-stride-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
          Admin · {name}
        </span>
        {pathname.startsWith("/miembros/classroom") && (
          <span className="flex flex-none items-center gap-1 text-xs font-semibold text-stride-accent">
            <GraduationCap className="h-3.5 w-3.5" /> Modo edición activo: entra a un curso para editar sus lecciones
          </span>
        )}
        <span className="ml-auto flex flex-none items-center gap-1.5">
          <Link
            href="/admin/miembros"
            className={clsx(
              "flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition",
              pending > 0
                ? "border-amber-500/50 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black"
                : "border-stride-accent/40 text-stride-accent hover:bg-stride-accent hover:text-white"
            )}
          >
            <BadgeCheck className="h-3 w-3" /> Verificaciones y asistencia
            {pending > 0 && (
              <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold leading-4 text-black">{pending}</span>
            )}
          </Link>
          {/* Retos, puntos y eventos se gestionan en sus propias pestañas (Retos / Ranking / Calendario). */}
        </span>
      </div>
    </div>
  );
}
