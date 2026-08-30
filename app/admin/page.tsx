import Link from "next/link";
import { ListTodo, IdCard, ScanLine, UserPlus, AlertTriangle, ArrowRight, ShieldAlert, Lock } from "lucide-react";
import { requireTeamMember, isStaff, isCurrentUserOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/membership";

export const dynamic = "force-dynamic";

async function count(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  build: (q: any) => any = (q) => q
): Promise<number> {
  const { count: n } = await build(supabase.from(table).select("*", { count: "exact", head: true }));
  return n ?? 0;
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await requireTeamMember();
  const supabase = await createClient();
  const today = todayInChile();

  const { error: pageError } = await searchParams;
  const staff = isStaff(member.role);
  const isOwner = await isCurrentUserOwner();

  // Un rebote silencioso desde una página sin permiso parece un bug del sistema.
  const deniedAccess = pageError === "sin-permiso";

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const hasSecondFactor = (authUser?.factors ?? []).some((f) => f.status === "verified");

  const [myOpenTasks, overdueTasks, activeMembers, newLeads, scansThisMonth] = await Promise.all([
    count(supabase, "tasks", (q) =>
      q.eq("assignee_id", member.id).in("status", ["pendiente", "en_progreso"])
    ),
    count(supabase, "tasks", (q) =>
      q.in("status", ["pendiente", "en_progreso"]).lt("due_date", today)
    ),
    staff ? count(supabase, "members", (q) => q.eq("status", "activa")) : Promise.resolve(0),
    staff ? count(supabase, "leads", (q) => q.eq("status", "nuevo")) : Promise.resolve(0),
    staff
      ? count(supabase, "scans", (q) => q.gte("scanned_at", `${today.slice(0, 7)}-01`))
      : Promise.resolve(0),
  ]);

  const { data: upcoming } = await supabase
    .from("events")
    .select("id, title, event_date, status")
    .gte("event_date", today)
    .order("event_date")
    .limit(4);

  const { data: myTasks } = await supabase
    .from("tasks")
    .select("id, title, priority, due_date, status")
    .eq("assignee_id", member.id)
    .in("status", ["pendiente", "en_progreso"])
    .order("due_date", { nullsFirst: false })
    .limit(5);

  const stats = [
    { label: "Mis tareas abiertas", value: myOpenTasks, icon: ListTodo, href: "/admin/tareas" },
    { label: "Tareas vencidas", value: overdueTasks, icon: AlertTriangle, href: "/admin/tareas", alert: overdueTasks > 0 },
    ...(staff
      ? [
          // La ficha de miembros es solo del dueño: al resto no se le ofrece un link que rebota.
          ...(isOwner
            ? [{ label: "Miembros activos", value: activeMembers, icon: IdCard, href: "/admin/miembros" }]
            : []),
          { label: "Leads sin contactar", value: newLeads, icon: UserPlus, href: "/admin/leads" },
          { label: "Escaneos este mes", value: scansThisMonth, icon: ScanLine, href: "/admin/escaneos" },
        ]
      : []),
  ];

  return (
    <div className="space-y-10">
      {deniedAccess && (
        <p className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          Esa sección no está disponible para tu rol, así que te trajimos de vuelta al inicio.
        </p>
      )}

      {!hasSecondFactor && (
        <Link href="/admin/seguridad" className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100 transition hover:border-amber-300/50">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">Tu cuenta entra solo con contraseña.</strong>{" "}
            Activa el segundo factor para proteger los datos de miembros y finanzas.
            <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </span>
        </Link>
      )}

      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">
          Hola, {member.nickname ?? member.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-white/50">Esto es lo que hay abierto hoy.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, href, alert }) => (
          <Link
            key={label}
            href={href}
            className={`card transition hover:border-white/20 ${
              alert ? "border-amber-500/40 bg-amber-500/5" : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/50">{label}</p>
                <p className="mt-1 font-heading text-3xl font-extrabold text-white">{value}</p>
              </div>
              <Icon className={`h-5 w-5 ${alert ? "text-amber-400" : "text-stride-accent"}`} />
            </div>
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold text-white">Mis tareas</h2>
          <Link
            href="/admin/tareas"
            className="flex items-center gap-1 text-sm text-stride-accent hover:underline"
          >
            Ver todas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {myTasks && myTasks.length > 0 ? (
          <ul className="space-y-2">
            {myTasks.map((task) => {
              const overdue = task.due_date && task.due_date < today;
              return (
                <li key={task.id} className="card flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{task.title}</p>
                    {task.due_date && (
                      <p className={`mt-0.5 text-xs ${overdue ? "text-red-400" : "text-white/40"}`}>
                        {overdue ? "Vencida el " : "Vence el "}
                        {task.due_date.split("-").reverse().join("/")}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      task.priority === "alta"
                        ? "bg-red-500/15 text-red-400"
                        : task.priority === "media"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-white/10 text-white/50"
                    }`}
                  >
                    {task.priority}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="card text-sm text-white/45">No tienes tareas abiertas. Buen momento.</p>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl font-bold text-white">Próximos eventos</h2>
          <Link
            href="/admin/eventos"
            className="flex items-center gap-1 text-sm text-stride-accent hover:underline"
          >
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {upcoming && upcoming.length > 0 ? (
          <ul className="space-y-2">
            {upcoming.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/admin/eventos/${event.id}`}
                  className="card flex items-center justify-between gap-4 py-4 transition hover:border-white/20"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{event.title}</p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {event.event_date.split("-").reverse().join("/")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs capitalize text-white/60">
                    {event.status.replace("_", " ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card text-sm text-white/45">No hay eventos agendados.</p>
        )}
      </section>
    </div>
  );
}
