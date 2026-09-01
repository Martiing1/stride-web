"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, MapPin, Route, Video } from "lucide-react";
import clsx from "clsx";
import { formatDateCL } from "@/lib/membership";
import { RsvpButtons } from "./RsvpButtons";
import type { MemberEvent } from "@/lib/community";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DOWS = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Calendario con dos vistas: Lista y Mes. En celular parte en Lista; en
 * escritorio parte en Mes (como pidió Martín).
 */
export function CalendarClient({ events, today }: { events: MemberEvent[]; today: string }) {
  const [view, setView] = useState<"lista" | "mes">("lista");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setView("mes");
  }, []);

  const [ty, tm] = today.split("-").map(Number);
  const monthLabel = `${MONTHS[tm - 1]} ${ty}`;

  const grid = useMemo(() => {
    const first = new Date(Date.UTC(ty, tm - 1, 1));
    const daysInMonth = new Date(ty, tm, 0).getDate();
    const lead = (first.getUTCDay() + 6) % 7; // lunes = 0
    const cells: Array<{ date: string | null; day: number | null }> = [];
    for (let i = 0; i < lead; i++) cells.push({ date: null, day: null });
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: `${today.slice(0, 8)}${String(day).padStart(2, "0")}`.slice(0, 8) + String(day).padStart(2, "0"), day });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
    return cells;
  }, [today, ty, tm]);

  const eventsOf = (date: string | null) => (date ? events.filter((e) => e.event_date === date) : []);
  const selectedEvents = selected ? eventsOf(selected) : [];
  const in7 = addDays(today, 7);
  const thisWeek = events.filter((e) => e.event_date <= in7);
  const later = events.filter((e) => e.event_date > in7);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-bold">{monthLabel}</h1>
        <div className="flex rounded-full border border-[var(--sline)] bg-[var(--scard2)] p-0.5">
          {(["lista", "mes"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={clsx(
                "rounded-full px-4 py-1.5 font-heading text-xs font-semibold capitalize transition",
                view === option ? "bg-[var(--shover)] text-[var(--stext)]" : "text-[var(--sdim)] hover:text-[var(--smut)]"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {events.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--sline2)] p-10 text-center">
          <p className="font-heading font-bold">Sin eventos confirmados por ahora</p>
          <p className="mt-1 text-sm text-[var(--smut)]">Te avisaremos por la campana cuando fijemos la próxima fecha.</p>
        </div>
      )}

      {view === "lista" ? (
        <div className="space-y-4">
          {thisWeek.length > 0 && <ListSection title="Esta semana" events={thisWeek} today={today} />}
          {later.length > 0 && <ListSection title="Más adelante" events={later} today={today} />}
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5">
          <div className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-4">
            <div className="grid grid-cols-7 gap-1.5">
              {DOWS.map((dow) => (
                <span key={dow} className="py-1 text-center text-[10px] font-bold uppercase text-[var(--sdim)]">
                  {dow}
                </span>
              ))}
              {grid.map((cell, index) => {
                const dayEvents = eventsOf(cell.date);
                const isToday = cell.date === today;
                const isSelected = cell.date === selected;
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={!cell.day}
                    onClick={() => cell.date && setSelected(cell.date)}
                    className={clsx(
                      "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-sm transition",
                      !cell.day && "border-transparent",
                      cell.day && "border-[var(--sline)] bg-[var(--scard2)]",
                      dayEvents.length > 0 && "cursor-pointer hover:border-[var(--sline2)]",
                      isToday && "border-stride-cyan text-stride-cyan",
                      isSelected && "border-stride-accent bg-[var(--ssoft)]"
                    )}
                  >
                    {cell.day && (
                      <>
                        <span className={clsx("leading-none", isToday && "font-bold")}>{cell.day}</span>
                        {dayEvents.length > 0 && (
                          <span className="flex gap-1">
                            {dayEvents.slice(0, 3).map((event) => (
                              <span
                                key={event.id}
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: event.is_online ? "#F59E0B" : "#00E5FF" }}
                              />
                            ))}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-[var(--sdim)]">
              <span className="mr-3 inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full" style={{ background: "#00E5FF" }} /> Social Run presencial</span>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full" style={{ background: "#F59E0B" }} /> Sesión online</span>
            </p>
          </div>

          <div className="mt-4 space-y-3 lg:mt-0">
            {selectedEvents.length > 0 ? (
              selectedEvents.map((event) => <EventCard key={event.id} event={event} today={today} />)
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--sline2)] p-6 text-center text-sm text-[var(--smut)]">
                Toca un día con evento para ver el detalle.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ListSection({ title, events, today }: { title: string; events: MemberEvent[]; today: string }) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">{title}</h2>
      {events.map((event) => (
        <EventCard key={event.id} event={event} today={today} />
      ))}
    </section>
  );
}

function EventCard({ event, today }: { event: MemberEvent; today: string }) {
  const isToday = event.event_date === today;
  return (
    <article className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-4">
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            "flex h-10 w-10 flex-none items-center justify-center rounded-xl",
            event.is_online ? "bg-amber-500/12 text-amber-500" : "bg-[var(--ssoft)] text-stride-accent"
          )}
        >
          {event.is_online ? <Video className="h-5 w-5" /> : <Route className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className="font-heading text-sm font-bold leading-snug">{event.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--smut)]">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateCL(event.event_date)}
              {event.event_time ? ` · ${event.event_time.slice(0, 5)} hrs` : ""}
            </span>
            {event.distance_km && <span>{event.distance_km} km</span>}
          </p>
          {event.meeting_point && (
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--smut)]">
              <MapPin className="h-3.5 w-3.5 flex-none" />
              {event.meeting_point_map_url ? (
                <a href={event.meeting_point_map_url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  {event.meeting_point}
                </a>
              ) : (
                event.meeting_point
              )}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {event.spots_left != null && !event.is_online && (
          <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-500">
            Quedan {event.spots_left} cupos
          </span>
        )}
        {!event.is_online && event.evently_url && (
          <a href={event.evently_url} target="_blank" rel="noopener noreferrer" className="btn-primary px-5 py-2 text-sm">
            Inscribirme
          </a>
        )}
        {event.is_online && (
          <>
            <RsvpButtons eventId={event.id} initial={event.my_rsvp} />
            {event.meet_url &&
              (isToday ? (
                <a href={event.meet_url} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
                  <Video className="h-4 w-4" /> Unirse por Meet
                </a>
              ) : (
                <span className="rounded-full border border-[var(--sline)] px-3.5 py-2 text-xs text-[var(--sdim)]">
                  el link se activa el día
                </span>
              ))}
          </>
        )}
        <AddToCalendar event={event} />
      </div>
    </article>
  );
}

/** "+ Mi calendario": Google Calendar directo o archivo .ics (Apple/Outlook). */
function AddToCalendar({ event }: { event: MemberEvent }) {
  const [open, setOpen] = useState(false);

  const googleUrl = () => {
    const date = event.event_date.replace(/-/g, "");
    const time = (event.event_time ?? "09:00").slice(0, 5);
    const [hh, mm] = [Number(time.slice(0, 2)), Number(time.slice(3, 5))];
    const endMinutes = hh * 60 + mm + 90;
    const start = `${date}T${time.replace(":", "")}00`;
    const end = `${date}T${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}${String(endMinutes % 60).padStart(2, "0")}00`;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `${event.title} · STRIDE`,
      dates: `${start}/${end}`,
      ctz: "America/Santiago",
      details: event.meet_url ? `Unirse: ${event.meet_url}` : "Nos vemos ahí 🏃",
    });
    if (event.meeting_point) params.set("location", event.meeting_point);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-[var(--sline2)] px-4 py-2 font-heading text-xs font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]"
      >
        + Mi calendario
      </button>
      {open && (
        <div className="absolute bottom-11 left-0 z-30 w-52 overflow-hidden rounded-xl border border-[var(--sline)] bg-[var(--scard)] shadow-xl shadow-black/30">
          <a
            href={googleUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--shover)]"
          >
            Google Calendar
          </a>
          <a
            href={`/miembros/calendario/ics/${event.id}`}
            onClick={() => setOpen(false)}
            className="block border-t border-[var(--sline)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--shover)]"
          >
            Apple / Outlook (.ics)
          </a>
        </div>
      )}
    </div>
  );
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
