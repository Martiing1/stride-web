"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importEventlyCsv } from "@/app/admin/comunidad/actions";

// ─── Import Evently ──────────────────────────────────────────────────────────

export function EventlyImport({ events }: { events: Array<{ id: string; title: string; event_date: string }> }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [sheet, setSheet] = useState<File | null>(null);
  const [onlyValidated, setOnlyValidated] = useState(true);
  const [pending, startTransition] = useTransition();

  // El .xlsx de Evently es binario: viaja tal cual al servidor. Un .csv se
  // vuelca en el textarea para poder revisarlo antes de importar.
  const readFile = (file: File | null) => {
    setError(null);
    if (!file) return setSheet(null);
    if (/\.csv$/i.test(file.name)) {
      setSheet(null);
      void file.text().then(setCsv);
    } else {
      setSheet(file);
      setCsv("");
    }
  };

  const clearFile = () => {
    setSheet(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = (formData: FormData) => {
    setError(null);
    setSummary(null);
    formData.set("csv", csv);
    if (sheet) formData.set("file", sheet);
    formData.set("only_validated", onlyValidated ? "si" : "no");
    startTransition(async () => {
      const result = await importEventlyCsv(formData);
      if (!result.ok) return setError(result.error ?? "No pudimos importar.");
      setSummary(result.summary ?? "Importado.");
      setCsv("");
      clearFile();
      router.refresh();
    });
  };

  return (
    <form action={submit} className="space-y-3">
      <label className="block text-xs text-white/50">
        Evento
        <select name="event_id" required className="mt-1 w-full rounded-xl border border-white/15 bg-stride-card px-3 py-2.5 text-sm outline-none">
          <option value="">Elige el evento…</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.event_date} · {event.title}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-white/50">
        Export de Evently (.xlsx o .csv) — súbelo o pégalo
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(e) => readFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-xs text-white/60 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white"
        />
      </label>
      {sheet ? (
        <div className="space-y-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-3">
          <p className="flex items-center justify-between gap-3 text-xs text-white/60">
            <span className="truncate">📄 {sheet.name}</span>
            <button type="button" onClick={clearFile} className="shrink-0 text-white/40 underline">
              quitar
            </button>
          </p>
          <label className="flex items-start gap-2 text-[11px] leading-relaxed text-white/50">
            <input
              type="checkbox"
              checked={onlyValidated}
              onChange={(e) => setOnlyValidated(e.target.checked)}
              className="mt-0.5"
            />
            Acreditar solo a los validados en la puerta («Fecha de Validación»). Desmárcalo para
            acreditar a todos los inscritos del archivo.
          </label>
        </div>
      ) : (
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={"nombre,email\nIsabel Molina,isabel@mail.com"}
          className="min-h-28 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 font-mono text-xs outline-none placeholder:text-white/25 focus:border-stride-cyan"
        />
      )}
      <button type="submit" disabled={pending || (!csv.trim() && !sheet)} className="btn-primary px-6 py-2.5 text-sm disabled:opacity-60">
        {pending ? "Importando…" : "Importar asistencia"}
      </button>
      {summary && <p className="text-sm font-semibold text-emerald-300">✓ {summary}</p>}
      {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
      <p className="text-[11px] leading-relaxed text-white/35">
        Se calza por email con los miembros: a cada match se le acredita la asistencia, sus puntos y el aviso
        por la campana. Las filas sin match quedan guardadas para revisarlas. Importar dos veces no duplica.
      </p>
    </form>
  );
}
