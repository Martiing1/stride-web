"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Loader2, Map, ExternalLink, Download, Upload,
  TrafficCone, AlertTriangle, Pencil, Archive, ArchiveRestore,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createRoute, updateRoute, archiveRoute, setRouteGpx } from "@/app/admin/rutas/actions";
import type { Route } from "@/lib/types";

const DIFFICULTY_TONES: Record<string, string> = {
  facil: "bg-emerald-500/15 text-emerald-400",
  media: "bg-stride-amber/15 text-stride-amber",
  dificil: "bg-red-500/15 text-red-400",
};

function RouteFields({ route }: { route?: Route }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="name">Nombre</label>
        <input id="name" name="name" required defaultValue={route?.name}
          className="input" placeholder="Costanera 5K" />
      </div>
      <div>
        <label className="label" htmlFor="start_point">Punto de partida</label>
        <input id="start_point" name="start_point" defaultValue={route?.start_point ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="end_point">Punto de llegada</label>
        <input id="end_point" name="end_point" defaultValue={route?.end_point ?? ""} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="distance_km">Distancia (km)</label>
          <input id="distance_km" name="distance_km" type="number" step="0.1" min="0"
            defaultValue={route?.distance_km ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="difficulty">Dificultad</label>
          <select id="difficulty" name="difficulty" defaultValue={route?.difficulty ?? ""} className="input">
            <option value="" className="bg-stride-card">Sin definir</option>
            <option value="facil" className="bg-stride-card">Fácil</option>
            <option value="media" className="bg-stride-card">Media</option>
            <option value="dificil" className="bg-stride-card">Difícil</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="traffic_lights">Semáforos</label>
          <input id="traffic_lights" name="traffic_lights" type="number" min="0"
            defaultValue={route?.traffic_lights ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="surface">Superficie</label>
          <input id="surface" name="surface" defaultValue={route?.surface ?? ""}
            className="input" placeholder="asfalto" />
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="external_url">Link (Strava, Maps, Wikiloc)</label>
        <input id="external_url" name="external_url" type="url"
          defaultValue={route?.external_url ?? ""} className="input" placeholder="https://…" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="safety_notes">Seguridad</label>
        <textarea id="safety_notes" name="safety_notes" rows={2} defaultValue={route?.safety_notes ?? ""}
          className="input resize-y" placeholder="Cruces peligrosos, tramos sin luz, veredas angostas…" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="notes">Notas</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={route?.notes ?? ""} className="input resize-y" />
      </div>
    </div>
  );
}

export function RoutesManager({ routes }: { routes: Route[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    if (id) data.set("id", id);

    const res = id ? await updateRoute(data) : await createRoute(data);
    setBusy(false);

    if (!res.ok) { setError(res.error ?? "No se pudo guardar."); return; }

    form.reset();
    setShowForm(false);
    setEditing(null);
    router.refresh();
  }

  /** Sube el GPX al bucket y guarda su URL pública en la ruta. */
  async function uploadGpx(routeId: string, file: File) {
    setUploading(routeId);
    setError(null);

    const path = `${routeId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("rutas").upload(path, file, { upsert: true });

    if (upErr) {
      setError("No se pudo subir el archivo. ¿Corriste la migración 002?");
      setUploading(null);
      return;
    }

    const { data } = supabase.storage.from("rutas").getPublicUrl(path);
    const form = new FormData();
    form.set("id", routeId);
    form.set("gpx_url", data.publicUrl);
    const res = await setRouteGpx(form);

    setUploading(null);
    if (!res.ok) setError(res.error ?? "No se pudo asociar el archivo.");
    router.refresh();
  }

  async function toggleArchive(route: Route) {
    const form = new FormData();
    form.set("id", route.id);
    form.set("active", String(!route.active));
    await archiveRoute(form);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {!showForm && (
        <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Nueva ruta
        </button>
      )}

      {showForm && (
        <form onSubmit={(e) => submit(e)} className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-white">Nueva ruta</h2>
            <button type="button" onClick={() => setShowForm(false)} aria-label="Cerrar"
              className="rounded-lg p-1.5 text-white/40 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <RouteFields />
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear ruta"}
          </button>
          <p className="text-xs text-white/35">El GPX se sube después, desde la ficha de la ruta.</p>
        </form>
      )}

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

      {routes.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <Map className="h-10 w-10 text-white/25" />
          <p className="font-heading text-lg font-bold text-white">Todavía no hay rutas</p>
          <p className="max-w-sm text-sm text-white/50">
            Guarda las rutas una vez y reutilízalas en cada Social Run, con sus advertencias
            de seguridad.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {routes.map((route) =>
            editing === route.id ? (
              <form key={route.id} onSubmit={(e) => submit(e, route.id)} className="card space-y-4 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-lg font-bold text-white">Editar ruta</h2>
                  <button type="button" onClick={() => setEditing(null)} aria-label="Cerrar"
                    className="rounded-lg p-1.5 text-white/40 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <RouteFields route={route} />
                <div className="flex gap-2">
                  <button type="submit" disabled={busy} className="btn-primary">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancelar</button>
                </div>
              </form>
            ) : (
              <article key={route.id} className={`card ${route.active ? "" : "opacity-50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-heading text-lg font-bold text-white">{route.name}</h3>
                    <p className="mt-0.5 text-xs text-white/45">
                      {route.start_point}
                      {route.end_point && route.end_point !== route.start_point && ` → ${route.end_point}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {route.distance_km && (
                      <span className="wordmark font-heading text-xl font-extrabold">{route.distance_km}K</span>
                    )}
                    {route.difficulty && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${DIFFICULTY_TONES[route.difficulty]}`}>
                        {route.difficulty}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                  {route.traffic_lights !== null && (
                    <span className="flex items-center gap-1.5">
                      <TrafficCone className="h-3.5 w-3.5 text-white/30" />
                      {route.traffic_lights} semáforos
                    </span>
                  )}
                  {route.surface && <span>{route.surface}</span>}
                </div>

                {route.safety_notes && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-stride-amber/10 p-2.5 text-xs leading-relaxed text-stride-amber/90">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {route.safety_notes}
                  </p>
                )}

                {route.notes && <p className="mt-2 text-xs text-white/50">{route.notes}</p>}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                  {route.gpx_url ? (
                    <a href={route.gpx_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white">
                      <Download className="h-3.5 w-3.5" /> GPX
                    </a>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-white/50 transition hover:border-white/30 hover:text-white">
                      {uploading === route.id ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo…</>
                      ) : (
                        <><Upload className="h-3.5 w-3.5" /> Subir GPX</>
                      )}
                      <input type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadGpx(route.id, f);
                        }} />
                    </label>
                  )}

                  {route.external_url && (
                    <a href={route.external_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white">
                      <ExternalLink className="h-3.5 w-3.5" /> Ver mapa
                    </a>
                  )}

                  <button type="button" onClick={() => setEditing(route.id)} aria-label="Editar"
                    className="ml-auto rounded-md p-1.5 text-white/30 transition hover:bg-white/5 hover:text-white">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => toggleArchive(route)}
                    aria-label={route.active ? "Archivar" : "Restaurar"}
                    className="rounded-md p-1.5 text-white/30 transition hover:bg-white/5 hover:text-white">
                    {route.active ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </article>
            )
          )}
        </div>
      )}
    </div>
  );
}
