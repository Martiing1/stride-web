import { Scale } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { RulesBook, type RuleRow, type ChangeRow } from "@/components/admin/RulesBook";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reglas vigentes" };

/**
 * Reglamento vivo de STRIDE. Junta en un solo lugar lo que hoy está repartido
 * entre el Reglamento Operativo (Nivel 3) y las decisiones de cada acta
 * (Nivel 4), y deja ver desde cuándo rige cada regla y qué la cambió.
 *
 * Visibilidad: los socios ven todo; el resto del equipo no ve las reglas
 * marcadas como 'socios' (RLS lo repite en la base).
 */
export default async function ReglasPage() {
  const member = await requireTeamMember();
  const isSocio = member.role === "socio";
  const service = createServiceClient();

  const rules = await safeQuery(
    () =>
      service
        .from("rules")
        .select("id, code, title, statement, level, area, source_ref, visibility, status, origin, origin_doc_url, origin_meeting_id, effective_from")
        .order("area")
        .order("code")
        .returns<RuleRow[]>(),
    [] as RuleRow[]
  );

  const visibles = isSocio ? rules : rules.filter((r) => r.visibility !== "socios");

  const changes = await safeQuery(
    () =>
      service
        .from("rule_changes")
        .select("id, rule_id, change_kind, previous_statement, reason, applied_at, meetings:meeting_id(title, meeting_date, drive_url)")
        .order("applied_at", { ascending: false })
        .returns<ChangeRow[]>(),
    [] as ChangeRow[]
  );

  const ocultas = rules.length - visibles.length;

  return (
    <div className="space-y-8">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
          <Scale className="h-3.5 w-3.5" /> Gobernanza
        </p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">Reglas vigentes</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">
          Lo que rige hoy en STRIDE, con su origen y su historia. Las de Nivel 3 vienen del Reglamento
          Operativo; las de Nivel 4 nacieron en una reunión y quedaron registradas en el acta.
          {ocultas > 0 && ` Hay ${ocultas} reglas reservadas a los socios que no aparecen acá.`}
        </p>
      </header>

      <RulesBook rules={visibles} changes={changes} isSocio={isSocio} />
    </div>
  );
}
