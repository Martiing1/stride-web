"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { staffDeleteEvent, staffSaveEvent } from "@/app/miembros/community-actions";
import type { MemberEvent } from "@/lib/community";

// Solo estos tipos se ofrecen al crear (Martín pidió un único Social Run);
// TYPE_LABELS conserva los demás para mostrar eventos históricos del ERP.
const TYPE_OPTIONS: Array<[string, string]> = [
  ["social_run", "Social Run"],
  ["sesion_online", "Sesión online"],
  ["club_lectura", "Club de lectura"],
  ["otro", "Otro"],
];

const TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(TYPE_OPTIONS),
  social_run_cafeteria: "Social Run Cafetería",
  social_run_sunset: "Social Run Sunset",
  marca: "Evento con marca",
  retiro: "Retiro",
  race_trip: "Race trip",
};

interface EventDraft {
  id?: string;
  title: string;
  event_type: string;
  event_date: string;
  event_time: string;
  meeting_point: string;
  meet_url: string;
  distance_km: string;
  evently_url: string;
}

const EMPTY: EventDraft = {
  title: "",
  event_type: "social_run",
  event_date: "",
  event_time: "",
  meeting_point: "",
  meet_url: "",
  distance_km: "",
  evently_url: "",
};

const field =
  "w-full rounded-xl border border-[var(--sline2)] bg-[var(--scard2)] px-3 py-2 text-sm text-[var(--stext)] outline-none focus:border-stride-accent";
const label = "block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--sdim)]";

/**
 * Gestión de eventos para el staff, dentro del propio Calendario:
 * crear, editar y eliminar sin pasar por el ERP.
 */
export function EventAdminPanel({ events }: { events: MemberEvent[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openEdit = (e: MemberEvent) =>
    setDraft({
      id: e.id,
      title: e.title,
      event_type: e.event_type,
      event_date: e.event_date,
      event_time: e.event_time?.slice(0, 5) ?? "",
      meeting_point: e.meeting_point ?? "",
      meet_url: e.meet_url ?? "",
      distance_km: e.distance_km ? String(e.distance_km) : "",
      evently_url: e.evently_url ?? "",
    });

  const submit = () => {
    if (!draft) return;
    const data = new FormData();
    for (const [key, value] of Object.entries(draft)) data.set(key, value ?? "");
    startTransition(async () => {
      const result = await staffSaveEvent(data);
      if (!result.ok) return setError(result.error ?? "No pudimos guardar.");
      setDraft(null);
      setError(null);
      router.refresh();
    });
  };

  const remove = (eventId: string) => {
    if (!window.confirm("¿Eliminar este evento? Se borran también sus confirmaciones de asistencia.")) return;
    startTransition(async () => {
      await staffDeleteEvent(eventId);
      router.refresh();
    });
  };

  // Cada tipo pide solo sus variables: Social Run lleva distancia e
  // inscripción; la sesión online solo un link; el club de lectura, un lugar.
  const type = draft?.event_type ?? "social_run";
  const online = type === "sesion_online";
  const isRun = type.startsWith("social_run");

  return (
    <section className="mb-5 rounded-2xl border border-stride-accent/35 bg-[var(--scard)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-heading text-sm font-bold">
          <span className="rounded-full bg-stride-accent px-2 py-0.5 text-[10px] font-bold uppercase text-white">Admin</span>
          Eventos del calendario
        </h2>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY })}
          className="flex items-center gap-1.5 rounded-full bg-stride-accent px-3.5 py-1.5 font-heading text-xs font-bold text-white transition hover:bg-stride-accentDark"
        >
          <Plus className="h-3.5 w-3.5" /> Crear evento
        </button>
      </div>

      {events.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-2 rounded-xl bg-[var(--scard2)] px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-xs font-bold">{e.title}</p>
                <p className="text-[11px] text-[var(--sdim)]">
                  {TYPE_LABELS[e.event_type] ?? e.event_type} · {e.event_date}
                  {e.event_time ? ` · ${e.event_time.slice(0, 5)}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => openEdit(e)} className="rounded-lg p-1.5 text-[var(--smut)] transition hover:bg-[var(--shover)]" aria-label="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => remove(e.id)} disabled={pending} className="rounded-lg p-1.5 text-[var(--smut)] transition hover:bg-red-500/15 hover:text-red-400" aria-label="Eliminar">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => setDraft(null)}>
          <div
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[var(--sline)] bg-[var(--scard)] p-5 sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-bold">{draft.id ? "Editar evento" : "Crear evento"}</h3>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg p-1.5 text-[var(--smut)] hover:bg-[var(--shover)]" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className={label}>Nombre *</label>
                <input className={field} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Social Run · Costanera" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={isRun ? "" : "col-span-2"}>
                  <label className={label}>Tipo</label>
                  <select className={field} value={draft.event_type} onChange={(e) => setDraft({ ...draft, event_type: e.target.value })}>
                    {TYPE_OPTIONS.map(([value, text]) => (
                      <option key={value} value={value}>{text}</option>
                    ))}
                    {/* Un evento histórico del ERP conserva su tipo original al editarlo. */}
                    {!TYPE_OPTIONS.some(([value]) => value === draft.event_type) && (
                      <option value={draft.event_type}>{TYPE_LABELS[draft.event_type] ?? draft.event_type}</option>
                    )}
                  </select>
                </div>
                {isRun && (
                  <div>
                    <label className={label}>Distancia (km)</label>
                    <input className={field} type="number" min="0" step="0.5" value={draft.distance_km} onChange={(e) => setDraft({ ...draft, distance_km: e.target.value })} placeholder="5" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Fecha *</label>
                  <input className={field} type="date" value={draft.event_date} onChange={(e) => setDraft({ ...draft, event_date: e.target.value })} />
                </div>
                <div>
                  <label className={label}>Hora</label>
                  <input className={field} type="time" value={draft.event_time} onChange={(e) => setDraft({ ...draft, event_time: e.target.value })} />
                </div>
              </div>
              {online ? (
                <div>
                  <label className={label}>Link de Google Meet</label>
                  <input className={field} value={draft.meet_url} onChange={(e) => setDraft({ ...draft, meet_url: e.target.value })} placeholder="https://meet.google.com/…" />
                </div>
              ) : (
                <div>
                  <label className={label}>Punto de encuentro</label>
                  <input className={field} value={draft.meeting_point} onChange={(e) => setDraft({ ...draft, meeting_point: e.target.value })} placeholder="Desembocadura, Costanera" />
                </div>
              )}
              {isRun && (
                <div>
                  <label className={label}>Link de Evently (inscripción)</label>
                  <input className={field} value={draft.evently_url} onChange={(e) => setDraft({ ...draft, evently_url: e.target.value })} placeholder="https://evently.cl/…" />
                </div>
              )}

              {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">{error}</p>}

              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="w-full rounded-full bg-stride-accent py-2.5 font-heading text-sm font-bold text-white transition hover:bg-stride-accentDark disabled:opacity-60"
              >
                {pending ? "Guardando…" : draft.id ? "Guardar cambios" : "Crear evento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
