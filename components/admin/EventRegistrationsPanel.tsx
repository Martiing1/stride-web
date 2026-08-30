"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Check, FileSpreadsheet, Loader2, NotebookPen, Upload, Users } from "lucide-react";
import { importRegistrations, saveInternalNotes, type ImportResult } from "@/app/admin/eventos/actions";

interface Stats {
  registered: number;
  validated: number;
}

/**
 * Datos internos del evento: inscritos importados de Evently y notas que
 * nunca llegan a la web pública.
 */
export function EventRegistrationsPanel({
  eventId,
  stats,
  internalNotes,
}: {
  eventId: string;
  stats: Stats | null;
  internalNotes: string | null;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RegistrationsCard eventId={eventId} stats={stats} />
      <InternalNotesCard eventId={eventId} internalNotes={internalNotes} />
    </div>
  );
}

function RegistrationsCard({ eventId, stats }: { eventId: string; stats: Stats | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setResult(null);
    startTransition(async () => {
      setResult(await importRegistrations(form));
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  const rate = stats && stats.registered > 0 ? Math.round((stats.validated / stats.registered) * 100) : null;

  return (
    <section className="card space-y-4">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white">
        <Users className="h-5 w-5 text-stride-cyan" /> Inscritos
      </h2>

      {stats && stats.registered > 0 ? (
        <dl className="grid grid-cols-3 gap-3">
          {[
            ["Inscritos", String(stats.registered)],
            ["Asistieron", String(stats.validated)],
            ["Asistencia", rate != null ? `${rate}%` : "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/[0.03] p-3 text-center">
              <dt className="text-[11px] uppercase tracking-wide text-white/35">{label}</dt>
              <dd className="mt-1 font-heading text-2xl font-extrabold text-white">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm leading-relaxed text-white/45">
          Exporta los inscritos desde Evently (.xlsx) y súbelos acá. La «Fecha de
          Validación» del archivo dice quién llegó de verdad.
        </p>
      )}

      <form onSubmit={submit} className="space-y-3 border-t border-white/5 pt-4">
        <input type="hidden" name="event_id" value={eventId} />
        <label htmlFor={`file-${eventId}`} className="label flex items-center gap-1.5">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Export de Evently
        </label>
        <input
          ref={fileRef}
          id={`file-${eventId}`}
          name="file"
          type="file"
          required
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full text-sm text-white/60 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/15"
        />
        {result && !result.ok && (
          <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{result.error}</p>
        )}
        {result?.ok && (
          <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            Importados {result.imported} inscritos · {result.validated} validados en puerta.
            {stats && stats.registered > 0 ? " Reimportar actualiza, no duplica." : ""}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> {stats && stats.registered > 0 ? "Reimportar" : "Importar"}</>}
        </button>
      </form>
    </section>
  );
}

function InternalNotesCard({ eventId, internalNotes }: { eventId: string; internalNotes: string | null }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await saveInternalNotes(form);
      if (result.ok) setSaved(true);
      else setError(result.error ?? "No se pudo guardar.");
    });
  }

  return (
    <section className="card space-y-4">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white">
        <NotebookPen className="h-5 w-5 text-stride-cyan" /> Notas internas
      </h2>
      <p className="text-sm text-white/45">
        Solo las ve el equipo: acuerdos con el colaborador, contactos, montos, pendientes.
        Nunca aparecen en la web ni en Evently.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input type="hidden" name="id" value={eventId} />
        <textarea
          name="internal_notes"
          rows={7}
          defaultValue={internalNotes ?? ""}
          className="input resize-y text-sm"
          placeholder={"Starbucks pone parlantes y sampling.\nContacto: Miguel +569…\nNegociar 50% dcto para miembros."}
        />
        {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Guardar notas</>}
          </button>
          {saved && <span className="text-sm text-emerald-300">Guardado ✓</span>}
        </div>
      </form>
    </section>
  );
}
