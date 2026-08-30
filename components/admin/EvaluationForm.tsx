"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { saveEvaluation } from "@/app/admin/evaluaciones/actions";

const RATINGS: Array<{ name: string; label: string; hint: string }> = [
  { name: "rating_overall", label: "El evento en general", hint: "¿Cómo estuvo el social run completo?" },
  { name: "rating_team", label: "El equipo", hint: "Coordinación, roles claros, apoyo entre líderes." },
  { name: "rating_safety", label: "Seguridad", hint: "Cruces, tránsito, grupo junto, botiquín." },
  { name: "rating_timing", label: "Tiempos", hint: "Puntualidad de salidas, bloques y cierres." },
];

/** Evaluación individual post social run. Bloquea el ERP hasta entregarla. */
export function EvaluationForm({ eventId }: { eventId: string }) {
  const [attended, setAttended] = useState<"si" | "no">("si");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await saveEvaluation(form);
      // Si todo sale bien la action redirige; llegar acá es un error.
      if (result && !result.ok) setError(result.error ?? "No se pudo guardar.");
    });
  }

  return (
    <form onSubmit={submit} className="card max-w-2xl space-y-6">
      <input type="hidden" name="event_id" value={eventId} />

      <div>
        <p className="label">¿Estuviste en el evento?</p>
        <div className="flex gap-2">
          {(["si", "no"] as const).map((option) => (
            <label key={option} className={`cursor-pointer rounded-full border px-5 py-2.5 text-sm font-semibold transition ${attended === option ? "border-stride-accent bg-stride-accent/15 text-white" : "border-white/10 text-white/50 hover:text-white"}`}>
              <input type="radio" name="attended" value={option} checked={attended === option} onChange={() => setAttended(option)} className="sr-only" />
              {option === "si" ? "Sí, asistí" : "No asistí"}
            </label>
          ))}
        </div>
      </div>

      {attended === "si" && (
        <div className="space-y-5">
          {RATINGS.map(({ name, label, hint }) => (
            <RatingRow key={name} name={name} label={label} hint={hint} required={name === "rating_overall"} />
          ))}

          <div>
            <label htmlFor="highlights" className="label">Qué funcionó bien</label>
            <textarea id="highlights" name="highlights" rows={2} className="input resize-y" placeholder="La dinámica de Nico, la ruta nueva…" />
          </div>
          <div>
            <label htmlFor="improvements" className="label">Qué mejorarías</label>
            <textarea id="improvements" name="improvements" rows={2} className="input resize-y" placeholder="Salimos 10 minutos tarde porque…" />
          </div>
          <div>
            <label htmlFor="incidents" className="label">Incidentes o temas de seguridad</label>
            <textarea id="incidents" name="incidents" rows={2} className="input resize-y" placeholder="Déjalo vacío si no hubo nada." />
          </div>
        </div>
      )}

      {attended === "no" && (
        <div>
          <label htmlFor="improvements" className="label">¿Algo que aportar igual? (opcional)</label>
          <textarea id="improvements" name="improvements" rows={2} className="input resize-y" placeholder="Feedback que te haya llegado, contexto de por qué no pudiste ir…" />
        </div>
      )}

      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Entregar evaluación</>}
      </button>
    </form>
  );
}

function RatingRow({ name, label, hint, required }: { name: string; label: string; hint: string; required: boolean }) {
  const [value, setValue] = useState(0);
  return (
    <div>
      <p className="label">{label}{required && <span className="text-stride-accent"> *</span>}</p>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border text-sm font-bold transition ${value === n ? "border-stride-accent bg-stride-accent/20 text-white" : value > n ? "border-stride-accent/40 bg-stride-accent/10 text-white/70" : "border-white/10 text-white/40 hover:text-white"}`}>
            <input type="radio" name={name} value={n} required={required} checked={value === n} onChange={() => setValue(n)} className="sr-only" />
            {n}
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs text-white/35">{hint}</p>
    </div>
  );
}
