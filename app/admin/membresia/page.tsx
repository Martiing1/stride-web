import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/membership";
import { MonthChecklist } from "@/components/admin/MonthChecklist";
import type { MonthChecklistItem, TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Suma o resta meses a un "YYYY-MM" sin depender de la zona horaria del server. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export default async function MembresiaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const { mes } = await searchParams;
  const today = todayInChile();

  const month = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : today.slice(0, 7);
  const [year, monthNum] = month.split("-").map(Number);

  const supabase = await createClient();
  const [{ data: itemsData }, { data: teamData }] = await Promise.all([
    supabase
      .from("membership_month_items")
      .select("*")
      .eq("month", `${month}-01`)
      .order("sort_order")
      .order("created_at"),
    // Solo los socios aparecen como responsables (02-09); otros nombres se escriben a mano.
    supabase.from("team_members").select("*").eq("status", "activo").eq("role", "socio").order("full_name"),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Plan del mes</h1>
        <p className="mt-1 max-w-2xl text-white/50">
          Todo lo que hay que tener listo en la membresía este mes. Se genera desde una
          plantilla y se va marcando.
        </p>
      </header>

      {/* Navegación de meses */}
      <nav className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-stride-card px-4 py-3">
        <Link
          href={`/admin/membresia?mes=${shiftMonth(month, -1)}`}
          aria-label="Mes anterior"
          className="rounded-lg p-2 text-white/50 transition hover:bg-white/5 hover:text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>

        <div className="text-center">
          <p className="font-heading text-xl font-bold text-white">
            {MONTH_NAMES[monthNum - 1]} {year}
          </p>
          {month !== today.slice(0, 7) && (
            <Link
              href="/admin/membresia"
              className="text-xs text-stride-cyan hover:underline"
            >
              Volver al mes actual
            </Link>
          )}
        </div>

        <Link
          href={`/admin/membresia?mes=${shiftMonth(month, 1)}`}
          aria-label="Mes siguiente"
          className="rounded-lg p-2 text-white/50 transition hover:bg-white/5 hover:text-white"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </nav>

      <MonthChecklist
        month={month}
        items={(itemsData ?? []) as MonthChecklistItem[]}
        team={(teamData ?? []) as TeamMember[]}
        today={today}
      />
    </div>
  );
}
