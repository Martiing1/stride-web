import { requireTeamMember, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/membership";
import { TaskBoard } from "@/components/admin/TaskBoard";
import { getAppConfig } from "@/lib/app-settings-server";
import type { Task, TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ responsable?: string; estado?: string }>;
}) {
  const member = await requireTeamMember();
  const { responsable, estado } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("tasks").select("*").order("due_date", { nullsFirst: false });

  // Cada persona entra viendo SUS tareas (pedido de Martín, 31-08); "Todo el
  // equipo" queda a un click en el filtro.
  const assigneeFilter = responsable ?? member.id;
  if (assigneeFilter && assigneeFilter !== "todos") {
    query = query.eq("assignee_id", assigneeFilter);
  }

  // Las hechas hace más de 30 días viven en el Archivo, no en el tablero.
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  query = query.or(`status.neq.hecha,updated_at.gte.${cutoff}`);

  if (estado && estado !== "todos" && estado !== "abiertas") {
    query = query.eq("status", estado);
  } else if (estado !== "todos") {
    // Por defecto se ocultan las tareas ya cerradas.
    query = query.in("status", ["pendiente", "en_progreso", "bloqueada", "recurrente"]);
  }

  const [{ data: tasksData }, { data: teamData }, config] = await Promise.all([
    query,
    supabase.from("team_members").select("*").eq("status", "activo").order("full_name"),
    getAppConfig(),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-white">Tareas</h1>
          <p className="mt-1 text-white/50">
            Lo que salió de las actas y lo que agrega el equipo, en un solo lugar.
          </p>
        </div>
        <a href="/admin/tareas/archivo" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-sm text-white/50 transition hover:text-white">
          Archivo (hechas +30 días)
        </a>
      </header>

      <TaskBoard
        tasks={(tasksData ?? []) as Task[]}
        team={(teamData ?? []) as TeamMember[]}
        currentMemberId={member.id}
        canCreate={isStaff(member.role)}
        isSocio={member.role === "socio"}
        today={todayInChile()}
        activeAssignee={assigneeFilter ?? "todos"}
        activeStatus={estado ?? "abiertas"}
        statusLabels={config.taskLabels}
      />
    </div>
  );
}
