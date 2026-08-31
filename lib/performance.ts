import { createClient } from "./supabase/server";
import { todayInChile } from "./membership";
import type { TeamMember } from "./types";

/**
 * Desempeño de líderes y monitores, calculado desde lo que el equipo ya hace
 * en el ERP: no hay que llenar nada aparte.
 *
 *  - Tareas: cuántas cerró y cuántas de ellas a tiempo.
 *  - Asistencia: social runs a los que declaró haber ido en su evaluación.
 *  - Cumplimiento: evaluaciones entregadas sobre las que le correspondían,
 *    que es el compromiso más concreto y medible que tienen.
 *  - Roles: veces que asumió planificación, ruta o liderazgo de un evento.
 */

export interface MemberPerformance {
  member: TeamMember;
  tasksTotal: number;
  tasksDone: number;
  tasksOverdue: number;
  onTimeRate: number | null;
  eventsAttended: number;
  evaluationsDue: number;
  evaluationsSent: number;
  complianceRate: number | null;
  rolesTaken: number;
  warnings: number;
  /** Nota 0-100 que resume lo anterior; null si no hay datos suficientes. */
  score: number | null;
}

export interface PerformanceWindow {
  from: string;
  rows: MemberPerformance[];
}

/** Ventana por defecto: los últimos 90 días. */
export async function getTeamPerformance(days = 90): Promise<PerformanceWindow> {
  const supabase = await createClient();
  const today = todayInChile();
  const from = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [teamRes, tasksRes, evalsRes, eventsRes, plansRes, warningsRes] = await Promise.all([
    supabase.from("team_members").select("*").eq("status", "activo").order("full_name"),
    supabase.from("tasks").select("assignee_id, status, due_date, updated_at").gte("created_at", `${from}T00:00:00Z`),
    supabase.from("event_evaluations").select("team_member_id, attended, event_id"),
    supabase
      .from("events")
      .select("id, event_date")
      .like("event_type", "social_run%")
      .in("status", ["confirmado", "completado"])
      .gte("event_date", from)
      .lt("event_date", today),
    supabase.from("event_plans").select("planner_id, route_owner_id, lead_id, sweeper_id, photographer_id"),
    supabase.from("warnings").select("team_member_id, severity").gte("issued_on", from),
  ]);

  const team = (teamRes.data ?? []) as TeamMember[];
  const tasks = tasksRes.data ?? [];
  const evaluations = evalsRes.data ?? [];
  const pastEvents = eventsRes.data ?? [];
  const plans = plansRes.data ?? [];
  // La tabla de amonestaciones puede no existir aún (migración 011).
  const warnings = warningsRes.error ? [] : warningsRes.data ?? [];

  const rows = team.map((member) => {
    const mine = tasks.filter((t) => t.assignee_id === member.id);
    const done = mine.filter((t) => t.status === "hecha");
    // "A tiempo" solo se puede juzgar en las que tenían fecha.
    const withDue = done.filter((t) => t.due_date);
    const onTime = withDue.filter((t) => (t.updated_at ?? "").slice(0, 10) <= (t.due_date as string));
    const overdue = mine.filter(
      (t) => t.status !== "hecha" && t.due_date && (t.due_date as string) < today
    );

    const myEvals = evaluations.filter((e) => e.team_member_id === member.id);
    const attended = myEvals.filter((e) => e.attended).length;
    const evaluationsDue = pastEvents.length;
    const evaluationsSent = myEvals.filter((e) => pastEvents.some((ev) => ev.id === e.event_id)).length;

    const rolesTaken = plans.filter((p) =>
      [p.planner_id, p.route_owner_id, p.lead_id, p.sweeper_id, p.photographer_id].includes(member.id)
    ).length;

    const onTimeRate = withDue.length ? onTime.length / withDue.length : null;
    const complianceRate = evaluationsDue ? evaluationsSent / evaluationsDue : null;
    const myWarnings = warnings.filter((w) => w.team_member_id === member.id);

    // Nota: 50% cierre de tareas, 30% puntualidad, 20% evaluaciones al día,
    // menos 8 puntos por amonestación escrita y 15 por una grave.
    const parts: Array<[number, number]> = [];
    if (mine.length) parts.push([done.length / mine.length, 50]);
    if (onTimeRate !== null) parts.push([onTimeRate, 30]);
    if (complianceRate !== null) parts.push([complianceRate, 20]);
    const weight = parts.reduce((s, [, w]) => s + w, 0);
    const penalty = myWarnings.reduce(
      (s, w) => s + (w.severity === "grave" ? 15 : w.severity === "escrita" ? 8 : 0),
      0
    );
    const score = weight
      ? Math.max(0, Math.round((parts.reduce((s, [v, w]) => s + v * w, 0) / weight) * 100) - penalty)
      : null;

    return {
      member,
      tasksTotal: mine.length,
      tasksDone: done.length,
      tasksOverdue: overdue.length,
      onTimeRate,
      eventsAttended: attended,
      evaluationsDue,
      evaluationsSent,
      complianceRate,
      rolesTaken,
      warnings: myWarnings.length,
      score,
    };
  });

  return { from, rows };
}
