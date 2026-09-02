"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Snowflake, Users, Package, CloudRain, Coffee } from "lucide-react";
import { savePlan } from "@/app/admin/planificaciones/actions";
import type { EventPlan, Route, TeamMember } from "@/lib/types";

/**
 * Planificación estructurada de un Social Run.
 *
 * Los campos siguen el orden real del evento (antes → durante → después) para
 * que llenarlo se parezca a recorrerlo mentalmente. El itinerario (`children`)
 * va en medio, y el estado + guardar + exportar quedan siempre al final.
 */
export function PlanForm({
  eventId,
  plan,
  routes,
  team,
  children,
  exportSlot,
}: {
  eventId: string;
  plan: EventPlan | null;
  routes: Route[];
  team: TeamMember[];
  children?: ReactNode;
  exportSlot?: ReactNode;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeId, setRouteId] = useState(plan?.route_id ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const data = new FormData(event.currentTarget);
    data.set("event_id", eventId);

    const res = await savePlan(data);
    setSaving(false);

    if (!res.ok) { setError(res.error ?? "No se pudo guardar."); return; }

    setSaved(true);
    router.refresh();
    window.setTimeout(() => setSaved(false), 3000);
  }

  const people = (label: string, name: string, value: string | null) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value ?? ""} className="input">
        <option value="" className="bg-stride-card">Sin asignar</option>
        {team.map((t) => (
          <option key={t.id} value={t.id} className="bg-stride-card">
            {t.nickname ?? t.full_name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Ruta y hora */}
      <section className="card space-y-4">
        <h2 className="font-heading text-lg font-bold text-white">Ruta y horario</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="route_id">Ruta guardada</label>
            <select id="route_id" name="route_id" value={routeId} onChange={(e) => setRouteId(e.target.value)} className="input">
              <option value="" className="bg-stride-card">Sin ruta guardada (escríbela abajo)</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id} className="bg-stride-card">
                  {r.name}{r.distance_km ? ` · ${r.distance_km}K` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="meeting_time">Hora de encuentro</label>
            <input id="meeting_time" name="meeting_time" type="time"
              defaultValue={plan?.meeting_time?.slice(0, 5) ?? ""} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="route_text">
              {routeId ? "Notas de la ruta para este evento" : "Ruta escrita"}
            </label>
            <textarea id="route_text" name="route_text" rows={2} defaultValue={plan?.route_text ?? ""}
              className="input resize-y"
              placeholder="Parque Ecuador → Costanera → vuelta por Chacabuco. 3K corta en el puente; 5K sigue hasta el muelle." />
            <p className="mt-1 text-xs text-white/35">
              No necesitas una ficha en Rutas para planificar: describe el recorrido acá y listo.
            </p>
          </div>
        </div>
      </section>

      {/* Equipo en terreno */}
      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white">
          <Users className="h-5 w-5 text-stride-cyan" /> Equipo en terreno
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {people("Encargado de la planificación", "planner_id", plan?.planner_id ?? null)}
          {people("Encargado de la ruta", "route_owner_id", plan?.route_owner_id ?? null)}
          {people("Lidera la corrida", "lead_id", plan?.lead_id ?? null)}
          {people("Cierra el grupo", "sweeper_id", plan?.sweeper_id ?? null)}
          {people("Registro y fotos", "photographer_id", plan?.photographer_id ?? null)}
        </div>
        <p className="text-xs text-white/35">
          Quien cierra el grupo va último y se asegura de que nadie quede atrás.
        </p>
      </section>

      {/* Desarrollo */}
      <section className="card space-y-4">
        <h2 className="font-heading text-lg font-bold text-white">Cómo se desarrolla</h2>

        <div>
          <label className="label flex items-center gap-1.5" htmlFor="icebreaker">
            <Snowflake className="h-3.5 w-3.5 text-stride-cyan" /> Dinámica rompehielo
          </label>
          <textarea id="icebreaker" name="icebreaker" rows={2} defaultValue={plan?.icebreaker ?? ""}
            className="input resize-y" placeholder="Cómo se presentan los que llegan por primera vez" />
          <p className="mt-1 text-xs text-white/35">
            Obligatoria en cada evento: es lo que hace que el que llega solo no se sienta solo.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="warmup_notes">Calentamiento</label>
          <textarea id="warmup_notes" name="warmup_notes" rows={2}
            defaultValue={plan?.warmup_notes ?? ""} className="input resize-y" />
        </div>

        <div>
          <label className="label" htmlFor="groups_notes">Grupos de ritmo</label>
          <textarea id="groups_notes" name="groups_notes" rows={2} defaultValue={plan?.groups_notes ?? ""}
            className="input resize-y" placeholder="3K / 5K, quién lidera cada grupo, qué hacen los que llegan primero" />
        </div>

        <div>
          <label className="label flex items-center gap-1.5" htmlFor="post_run_notes">
            <Coffee className="h-3.5 w-3.5 text-stride-cyan" /> Después de correr
          </label>
          <textarea id="post_run_notes" name="post_run_notes" rows={2}
            defaultValue={plan?.post_run_notes ?? ""} className="input resize-y"
            placeholder="Juegos, sorteos, regalos, café" />
        </div>
      </section>

      {/* Preparativos */}
      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white">
          <Package className="h-5 w-5 text-stride-cyan" /> Preparativos
        </h2>

        <div>
          <label className="label" htmlFor="materials">Qué hay que llevar</label>
          <textarea id="materials" name="materials" rows={2} defaultValue={plan?.materials ?? ""}
            className="input resize-y" placeholder="Botiquín, hidratación, conos, bandera, parlante" />
        </div>

        <div>
          <label className="label" htmlFor="sponsor_notes">Marca o colaborador</label>
          <textarea id="sponsor_notes" name="sponsor_notes" rows={2} defaultValue={plan?.sponsor_notes ?? ""}
            className="input resize-y" placeholder="Qué aporta y qué le prometimos a cambio" />
        </div>

        <div>
          <label className="label flex items-center gap-1.5" htmlFor="contingency">
            <CloudRain className="h-3.5 w-3.5 text-stride-cyan" /> Plan B
          </label>
          <textarea id="contingency" name="contingency" rows={2} defaultValue={plan?.contingency ?? ""}
            className="input resize-y" placeholder="Qué hacemos si llueve o si llega menos gente" />
        </div>
      </section>

      {/* Itinerario del día (hora a hora, grupos, checklist) */}
      {children}

      {/* Estado, guardar y exportar: siempre al final */}
      <div className="card flex flex-wrap items-end justify-between gap-4">
        <div>
          <label className="label" htmlFor="status">Estado</label>
          <select id="status" name="status" defaultValue={plan?.status ?? "borrador"} className="input w-auto">
            <option value="borrador" className="bg-stride-card">Borrador</option>
            <option value="lista" className="bg-stride-card">Lista</option>
            <option value="ejecutada" className="bg-stride-card">Ejecutada</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Guardado
            </span>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar planificación"}
          </button>
          {exportSlot}
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
    </form>
  );
}
