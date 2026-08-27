import Link from "next/link";
import { CalendarDays, Users, CheckCircle2, XCircle, Globe } from "lucide-react";
import { requireTeamMember, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/membership";
import { NewEventForm } from "@/components/admin/NewEventForm";
import type { StrideEvent, EventConfirmationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  planificacion: "bg-white/10 text-white/60",
  encuesta_abierta: "bg-amber-500/15 text-amber-400",
  confirmado: "bg-emerald-500/15 text-emerald-400",
  cancelado: "bg-red-500/15 text-red-400",
  completado: "bg-white/10 text-white/40",
};

const STATUS_LABELS: Record<string, string> = {
  planificacion: "Planificación",
  encuesta_abierta: "Encuesta abierta",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  completado: "Completado",
};

export default async function EventosAdminPage() {
  const member = await requireTeamMember();
  const supabase = await createClient();
  const today = todayInChile();

  const [{ data: eventsData }, { data: statusData }] = await Promise.all([
    supabase.from("events").select("*").order("event_date", { ascending: false }),
    supabase.from("event_confirmation_status").select("*"),
  ]);

  const events = (eventsData ?? []) as StrideEvent[];
  const confirmations = new Map(
    ((statusData ?? []) as EventConfirmationStatus[]).map((s) => [s.event_id, s])
  );

  const upcoming = events.filter((e) => e.event_date >= today);
  const past = events.filter((e) => e.event_date < today);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Eventos</h1>
        <p className="mt-1 max-w-2xl text-white/50">
          Flujo del domingo: se abre la encuesta, y el evento se confirma solo si responden que sí
          al menos el mínimo de personas.
        </p>
      </header>

      {isStaff(member.role) && <NewEventForm />}

      <section>
        <h2 className="mb-4 font-heading text-xl font-bold text-white">Próximos</h2>
        {upcoming.length > 0 ? (
          <ul className="space-y-2">
            {upcoming.map((event) => {
              const conf = confirmations.get(event.id);
              return (
                <li key={event.id}>
                  <Link
                    href={`/admin/eventos/${event.id}`}
                    className="card flex flex-wrap items-center gap-4 transition hover:border-white/20"
                  >
                    <div className="min-w-[180px] flex-1">
                      <p className="font-medium text-white">{event.title}</p>
                      <p className="mt-0.5 text-xs text-white/40">
                        {event.event_date.split("-").reverse().join("/")}
                        {event.event_time && ` · ${event.event_time.slice(0, 5)}`}
                        {event.meeting_point && ` · ${event.meeting_point}`}
                      </p>
                    </div>

                    {conf && (
                      <span
                        className={`flex shrink-0 items-center gap-1.5 text-xs ${
                          conf.meets_minimum ? "text-emerald-400" : "text-white/45"
                        }`}
                      >
                        {conf.meets_minimum ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Users className="h-3.5 w-3.5" />
                        )}
                        {conf.confirmed_count}/{event.min_confirmations}
                      </span>
                    )}

                    {event.is_public && (
                      <Globe className="h-3.5 w-3.5 shrink-0 text-stride-accent" aria-label="Publicado en la web" />
                    )}

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        STATUS_STYLES[event.status]
                      }`}
                    >
                      {STATUS_LABELS[event.status]}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <CalendarDays className="h-9 w-9 text-white/25" />
            <p className="text-sm text-white/50">No hay eventos próximos agendados.</p>
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-4 font-heading text-xl font-bold text-white">Pasados</h2>
          <ul className="space-y-2">
            {past.slice(0, 15).map((event) => (
              <li key={event.id}>
                <Link
                  href={`/admin/eventos/${event.id}`}
                  className="card flex items-center justify-between gap-4 py-3 opacity-60 transition hover:opacity-100"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{event.title}</p>
                    <p className="text-xs text-white/40">
                      {event.event_date.split("-").reverse().join("/")}
                    </p>
                  </div>
                  {event.status === "cancelado" && (
                    <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
