import Link from "next/link";
import { Archive, ArrowLeft, Lock } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReopenTaskButton } from "@/components/admin/ReopenTaskButton";
import type { Task, TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Archivo de tareas" };

/** Tareas hechas hace más de 30 días: fuera del tablero, sin perderse. */
export default async function ArchivoTareasPage() {
  await requireTeamMember();
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [{ data: tasksData }, { data: teamData }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("status", "hecha")
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: false })
      .limit(300),
    supabase.from("team_members").select("id, full_name, nickname"),
  ]);
  const tasks = (tasksData ?? []) as Task[];
  const team = (teamData ?? []) as Pick<TeamMember, "id" | "full_name" | "nickname">[];
  const nameOf = (t: Task) => {
    const p = team.find((x) => x.id === t.assignee_id);
    return p ? (p.nickname ?? p.full_name) : (t.assignee_label ?? "Sin asignar");
  };

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/tareas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Tareas
        </Link>
        <h1 className="flex items-center gap-2.5 font-heading text-3xl font-extrabold text-white">
          <Archive className="h-7 w-7 text-stride-cyan" /> Archivo
        </h1>
        <p className="mt-1 max-w-2xl text-white/50">
          {tasks.length} tareas completadas hace más de 30 días. El tablero queda liviano;
          el historial, entero.
        </p>
      </header>

      {tasks.length === 0 ? (
        <p className="card py-12 text-center text-sm text-white/40">
          Nada archivado todavía: las hechas llegan solas acá al cumplir 30 días.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="card flex flex-wrap items-center gap-4 py-3.5">
              <div className="min-w-[220px] flex-1">
                <p className="text-sm text-white/60">
                  {task.visibility === "socios" && <Lock className="mr-1.5 inline h-3 w-3 text-stride-amber" aria-label="Solo socios" />}
                  {task.title}
                </p>
                <p className="mt-1 text-xs text-white/35">
                  {nameOf(task)}
                  {task.area && ` · ${task.area}`}
                  {` · terminada ${new Date(task.updated_at).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}`}
                </p>
              </div>
              <ReopenTaskButton taskId={task.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
