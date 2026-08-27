"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";
import { createEvent } from "@/app/admin/eventos/actions";

const TYPES = [
  { value: "social_run", label: "Social Run" },
  { value: "social_run_cafeteria", label: "Social Run Cafetería" },
  { value: "social_run_sunset", label: "Social Run Sunset" },
  { value: "marca", label: "Evento con marca" },
  { value: "retiro", label: "Retiro" },
  { value: "race_trip", label: "Race Trip" },
  { value: "otro", label: "Otro" },
];

export function NewEventForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = event.currentTarget;
    const res = await createEvent(new FormData(form));
    setSaving(false);

    if (!res.ok) {
      setError(res.error ?? "No se pudo crear.");
      return;
    }

    form.reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Nuevo evento
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold text-white">Nuevo evento</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="rounded-lg p-1.5 text-white/40 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">
            Nombre
          </label>
          <input id="title" name="title" required className="input" placeholder="Social Run Sunset" />
        </div>

        <div>
          <label className="label" htmlFor="event_type">
            Tipo
          </label>
          <select id="event_type" name="event_type" defaultValue="social_run" className="input">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-stride-card">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="event_date">
              Fecha
            </label>
            <input id="event_date" name="event_date" type="date" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="event_time">
              Hora
            </label>
            <input id="event_time" name="event_time" type="time" className="input" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="meeting_point">
            Punto de encuentro
          </label>
          <input
            id="meeting_point"
            name="meeting_point"
            className="input"
            placeholder="Teatro Biobío"
          />
        </div>

        <div>
          <label className="label" htmlFor="meeting_point_map_url">
            Link del mapa
          </label>
          <input
            id="meeting_point_map_url"
            name="meeting_point_map_url"
            type="url"
            className="input"
            placeholder="https://maps.app.goo.gl/…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="distance_km">
              Distancia (km)
            </label>
            <input
              id="distance_km"
              name="distance_km"
              type="number"
              step="0.5"
              min="0"
              className="input"
              placeholder="5"
            />
          </div>
          <div>
            <label className="label" htmlFor="min_confirmations">
              Mínimo equipo
            </label>
            <input
              id="min_confirmations"
              name="min_confirmations"
              type="number"
              min="1"
              defaultValue={3}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="evently_url">
            Link de Evently
          </label>
          <input
            id="evently_url"
            name="evently_url"
            type="url"
            className="input"
            placeholder="https://evently…"
          />
          <p className="mt-1 text-xs text-white/35">Necesario para publicarlo en la web.</p>
        </div>

        <div>
          <label className="label" htmlFor="spots_left">
            Cupos disponibles
          </label>
          <input
            id="spots_left"
            name="spots_left"
            type="number"
            min="0"
            className="input"
            placeholder="Sin tope"
          />
          <p className="mt-1 text-xs text-white/35">
            Si lo dejas vacío no se muestra nada. Con 15 o menos aparece &quot;Pocas plazas&quot;;
            con 5 o menos, &quot;Últimos lugares&quot;.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear evento"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Cancelar
        </button>
      </div>
    </form>
  );
}
