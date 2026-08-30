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

  // Un monitor entra directo a sus tareas; el resto ve todo salvo que filtre.
  const assigneeFilter = responsable ?? (member.role === "monitor" ? member.id : undefined);
  if (assigneeFilter && assigneeFilter !== "todos") {
    query = query.eq("assignee_id", assigneeFilter);
  }

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
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Tareas</h1>
        <p className="mt-1 text-white/50">
          Lo que salió de las actas y lo que agrega el equipo, en un solo lugar.
        </p>
      </header>

      <TaskBoard
        tasks={(tasksData ?? []) as Task[]}
        team={(teamData ?? []) as TeamMember[]}
        currentMemberId={member.id}
        canCreate={isStaff(member.role)}
        today={todayInChile()}
        activeAssignee={assigneeFilter ?? "todos"}
        activeStatus={estado ?? "abiertas"}
        statusLabels={config.taskLabels}
      />
    </div>
  );
}
