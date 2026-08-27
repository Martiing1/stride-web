import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gavel, ListTodo, Repeat } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Meeting, Decision, Followup, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ActaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeamMember();
  const { id } = await params;
  const supabase = await createClient();

  const { data: meetingData } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!meetingData) notFound();
  const meeting = meetingData as Meeting;

  const [{ data: tasksData }, { data: decisionsData }, { data: followupsData }] = await Promise.all([
    supabase.from("tasks").select("*").eq("meeting_id", id).order("due_date", { nullsFirst: false }),
    supabase.from("decisions").select("*").eq("meeting_id", id),
    supabase.from("followups").select("*").eq("meeting_id", id),
  ]);

  const tasks = (tasksData ?? []) as Task[];
  const decisions = (decisionsData ?? []) as Decision[];
  const followups = (followupsData ?? []) as Followup[];

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/actas"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Actas
        </Link>

        <h1 className="font-heading text-3xl font-extrabold text-white">{meeting.title}</h1>
        <p className="mt-1 text-white/50">
          {meeting.meeting_date.split("-").reverse().join("/")}
          {meeting.attendees.length > 0 && ` · ${meeting.attendees.join(", ")}`}
          {meeting.code && (
            <span className="ml-2 font-mono text-xs text-white/30">{meeting.code}</span>
          )}
        </p>
      </header>

      {tasks.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold text-white">
            <ListTodo className="h-5 w-5 text-stride-accent" /> Tareas ({tasks.length})
          </h2>
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.id} className="card flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-white">{task.title}</p>
                  <p className="mt-0.5 text-xs text-white/40">
                    {task.assignee_label ?? "Sin asignar"}
                    {task.area && ` · ${task.area}`}
                    {task.due_date && ` · ${task.due_date.split("-").reverse().join("/")}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs capitalize text-white/60">
                  {task.status.replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {decisions.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold text-white">
            <Gavel className="h-5 w-5 text-stride-accent" /> Decisiones ({decisions.length})
          </h2>
          <ul className="space-y-2">
            {decisions.map((d) => (
              <li key={d.id} className="card py-4">
                <p className="text-sm leading-relaxed text-white/85">{d.content}</p>
                <p className="mt-1.5 text-xs text-white/35">
                  {d.area}
                  {d.kind && ` · ${d.kind}`}
                  {d.is_doc_update && " · actualiza documentación"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {followups.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-bold text-white">
            <Repeat className="h-5 w-5 text-stride-accent" /> Seguimientos ({followups.length})
          </h2>
          <ul className="space-y-2">
            {followups.map((f) => (
              <li key={f.id} className="card py-3">
                <p className="text-sm text-white/85">{f.content}</p>
                <p className="mt-1 text-xs text-white/35">{f.area}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-heading text-xl font-bold text-white">Acta completa</h2>
        <div className="card">
          <pre className="whitespace-pre-wrap font-body text-sm leading-relaxed text-white/70">
            {meeting.content_md}
          </pre>
        </div>
      </section>
    </div>
  );
}
