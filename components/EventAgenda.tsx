import Link from "next/link";
import { Clock, MapPin, Route, Ticket, CalendarDays, ExternalLink } from "lucide-react";
import type { StrideEvent } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  social_run: "Social Run",
  social_run_cafeteria: "Social Run Cafetería",
  social_run_sunset: "Social Run Sunset",
  marca: "Evento con marca",
  retiro: "Retiro",
  race_trip: "Race Trip",
  otro: "Evento",
};

const MONTHS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

function splitDate(date: string) {
  const [, m, d] = date.split("-");
  return { day: d, month: MONTHS[Number(m) - 1] };
}

/**
 * Aviso de escasez. Solo aparece cuando `spots_left` está cargado de verdad:
 * un "últimos cupos" permanente y falso quema la credibilidad de la comunidad.
 */
function spotsBadge(spotsLeft: number | null) {
  if (spotsLeft === null) return null;
  if (spotsLeft <= 0) return { label: "Agotado", tone: "bg-white/10 text-white/50" };
  if (spotsLeft <= 5) return { label: "¡Últimos lugares!", tone: "bg-red-500/15 text-red-400" };
  if (spotsLeft <= 15) return { label: "Pocas plazas", tone: "bg-stride-amber/15 text-stride-amber" };
  return null;
}

export function EventAgenda({ events }: { events: StrideEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-4 py-16 text-center">
        <CalendarDays className="h-10 w-10 text-white/25" />
        <div>
          <p className="font-heading text-xl font-bold text-white">
            Estamos cerrando la próxima fecha
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/60">
            Confirmamos cada Social Run la semana previa, según la ruta y el equipo disponible.
            Déjanos tus datos y te avisamos apenas esté.
          </p>
        </div>
        <Link href="#sumate" className="btn-primary">
          Avísenme del próximo
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {events.map((event) => {
        const { day, month } = splitDate(event.event_date);
        const badge = spotsBadge(event.spots_left);
        const soldOut = event.spots_left !== null && event.spots_left <= 0;

        return (
          <li key={event.id} className="gradient-border !rounded-2xl">
            <article className="flex flex-col gap-4 rounded-[calc(1rem-1.5px)] bg-stride-card p-4 sm:flex-row sm:items-center sm:px-5">
              {/* Fecha */}
              <div className="flex shrink-0 flex-row items-center gap-2 sm:w-20 sm:flex-col sm:gap-0">
                <span className="wordmark font-heading text-4xl font-extrabold leading-none">
                  {day}
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                  {month}
                </span>
              </div>

              <div className="hidden h-14 w-px shrink-0 bg-white/10 sm:block" />

              {/* Detalle */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-stride-cyan">
                    {TYPE_LABELS[event.event_type] ?? "Evento"}
                  </span>
                  {badge && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${badge.tone}`}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>

                <h3 className="mt-1 font-heading text-xl font-bold leading-tight text-white">
                  {event.title}
                </h3>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/60">
                  {event.event_time && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-white/30" />
                      {event.event_time.slice(0, 5)} hrs
                    </span>
                  )}

                  {event.meeting_point && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-white/30" />
                      {event.meeting_point_map_url ? (
                        <a
                          href={event.meeting_point_map_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline decoration-white/20 underline-offset-2 transition hover:text-white"
                        >
                          {event.meeting_point}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        event.meeting_point
                      )}
                    </span>
                  )}

                  {event.distance_km && (
                    <span className="flex items-center gap-1.5">
                      <Route className="h-4 w-4 text-white/30" />
                      {event.distance_km} km
                    </span>
                  )}
                </div>

              </div>

              {/* Acción */}
              <div className="shrink-0">
                {soldOut ? (
                  <span className="inline-flex cursor-not-allowed items-center rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white/35">
                    Agotado
                  </span>
                ) : event.evently_url ? (
                  <a
                    href={event.evently_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full px-5 py-2.5 text-sm sm:w-auto"
                  >
                    <Ticket className="h-4 w-4" />
                    Reservar cupo
                  </a>
                ) : (
                  <Link href="#sumate" className="btn-secondary w-full sm:w-auto">
                    Quiero ir
                  </Link>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
