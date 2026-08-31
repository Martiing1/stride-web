import { BookLock } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { IncumplimientosBook, type IncumplimientoRow, type PlanRow } from "@/components/admin/IncumplimientosBook";
import type { TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Libro de Incumplimientos" };

/**
 * Libro de Incumplimientos del Pacto de Socios (capítulo 10). Los socios ven y
 * gestionan todo; cualquier otra persona del equipo ve solo lo suyo, por RLS.
 */
export default async function IncumplimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const member = await requireTeamMember();
  const { persona } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("incumplimientos").select("*").order("occurred_on", { ascending: false });
  if (persona) query = query.eq("team_member_id", persona);

  const [{ data: rows, error }, { data: plans }, { data: team }] = await Promise.all([
    query,
    supabase.from("improvement_plans").select("*").order("started_on", { ascending: false }),
    supabase.from("team_members").select("*").eq("status", "activo").order("full_name"),
  ]);

  const isSocio = member.role === "socio";

  return (
    <div className="space-y-8">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
          <BookLock className="h-3.5 w-3.5" /> Gobernanza
        </p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">Libro de Incumplimientos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          {isSocio
            ? "Registro oficial del capítulo 10 del Pacto de Socios: se registra, se notifica, hay 5 días hábiles de descargos y subsanación, y recién ahí se califica. Tres leves efectivos en 6 meses obligan a un Plan de Mejora."
            : "Acá ves lo que se haya registrado sobre ti y puedes presentar tus descargos. Nadie puede registrar algo sin notificártelo."}
        </p>
      </header>

      {error ? (
        <p className="card py-12 text-center text-sm text-white/40">
          Corre la migración 011 para activar el Libro de Incumplimientos.
        </p>
      ) : (
        <IncumplimientosBook
          rows={(rows ?? []) as IncumplimientoRow[]}
          plans={(plans ?? []) as PlanRow[]}
          team={(team ?? []) as TeamMember[]}
          isSocio={isSocio}
          currentMemberId={member.id}
        />
      )}
    </div>
  );
}
