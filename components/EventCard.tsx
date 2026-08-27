import Image from "next/image";
import { CalendarDays, Clock, MapPin, Route, Ticket, ExternalLink } from "lucide-react";
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

function formatLongDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function EventCard({ event, past = false }: { event: StrideEvent; past?: boolean }) {
  return (
    <article className={`card flex flex-col overflow-hidden p-0 ${past ? "opacity-60" : ""}`}>
      {event.cover_image_url && (
        <div className="relative aspect-[16/9] w-full">
          <Image
            src={event.cover_image_url}
            alt={event.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-stride-accent">
          {TYPE_LABELS[event.event_type] ?? "Evento"}
        </span>

        <h3 className="mt-2 font-heading text-xl font-bold leading-tight text-white">
          {event.title}
        </h3>

        <dl className="mt-4 flex-1 space-y-2 text-sm text-white/55">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-white/30" />
            <span className="capitalize">{formatLongDate(event.event_date)}</span>
          </div>

          {event.event_time && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-white/30" />
              <span>{event.event_time.slice(0, 5)} hrs</span>
            </div>
          )}

          {event.meeting_point && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
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
                <span>{event.meeting_point}</span>
              )}
            </div>
          )}

          {event.distance_km && (
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 shrink-0 text-white/30" />
              <span>{event.distance_km} km</span>
            </div>
          )}
        </dl>

        {!past && event.evently_url && (
          <a
            href={event.evently_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-6 w-full"
          >
            <Ticket className="h-4 w-4" />
            Inscribirme
          </a>
        )}
      </div>
    </article>
  );
}
