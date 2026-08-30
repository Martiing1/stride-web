import { createClient } from "./supabase/server";
import { todayInChile } from "./membership";
import type { StrideEvent } from "./types";

/** Ventana hacia atrás en la que un social run sin evaluar bloquea el ERP. */
const BLOCK_WINDOW_DAYS = 14;

function isoDaysAgo(days: number): string {
  const [y, m, d] = todayInChile().split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d - days));
  return date.toISOString().slice(0, 10);
}

/**
 * Social runs ya ocurridos que esta persona aún no evalúa.
 *
 * Decisión de Martín (30-08): la evaluación es individual y bloqueante — cada
 * líder, monitor y admin rellena la suya, y mientras no lo haga SU ERP queda
 * bloqueado. La ventana de 14 días evita que un evento antiguo (o de prueba)
 * deje el sistema cerrado para siempre, y "no asistí" también desbloquea.
 */
export async function getPendingEvaluations(teamMemberId: string): Promise<StrideEvent[]> {
  const supabase = await createClient();
  const today = todayInChile();

  const [{ data: events, error: eventsError }, { data: mine, error: mineError }] =
    await Promise.all([
      supabase
        .from("events")
        .select("*")
        .like("event_type", "social_run%")
        .in("status", ["confirmado", "completado"])
        .lt("event_date", today)
        .gte("event_date", isoDaysAgo(BLOCK_WINDOW_DAYS))
        .order("event_date"),
      supabase.from("event_evaluations").select("event_id").eq("team_member_id", teamMemberId),
    ]);

  // Si la tabla aún no existe (migración 004 sin aplicar) no se bloquea nada:
  // un despliegue nunca debe dejar el ERP cerrado por una consulta fallida.
  if (eventsError || mineError) return [];

  const done = new Set((mine ?? []).map((e) => e.event_id as string));
  return ((events ?? []) as StrideEvent[]).filter((e) => !done.has(e.id));
}
