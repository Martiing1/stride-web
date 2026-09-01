"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, GraduationCap, Settings2, Upload } from "lucide-react";

/**
 * Barra del staff dentro del área de miembros: identifica la vista de admin
 * y da acceso directo a la gestión (que vive en el ERP, mismo login).
 */
export function AdminBar({ name }: { name: string }) {
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
          <Link href="/admin/comunidad" className="flex items-center gap-1 rounded-full border border-stride-accent/40 px-3 py-1 text-[11px] font-semibold text-stride-accent transition hover:bg-stride-accent hover:text-white">
            <BadgeCheck className="h-3 w-3" /> Verificaciones
          </Link>
          <Link href="/admin/comunidad/asistencia" className="flex items-center gap-1 rounded-full border border-stride-accent/40 px-3 py-1 text-[11px] font-semibold text-stride-accent transition hover:bg-stride-accent hover:text-white">
            <Upload className="h-3 w-3" /> Asistencia
          </Link>
          <Link href="/admin/comunidad/retos" className="flex items-center gap-1 rounded-full border border-stride-accent/40 px-3 py-1 text-[11px] font-semibold text-stride-accent transition hover:bg-stride-accent hover:text-white">
            <Settings2 className="h-3 w-3" /> Retos y puntos
          </Link>
        </span>
      </div>
    </div>
  );
}
