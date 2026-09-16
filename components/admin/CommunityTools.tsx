"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importEventlyCsv, linkAttendance } from "@/app/admin/comunidad/actions";

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
        Se calza por email con los miembros y, si no calza, por nombre completo cuando no hay dudas. A cada match
        se le acredita la asistencia, sus puntos y el aviso por la campana. Las filas sin match quedan abajo para
        enlazarlas a mano.
      </p>
    </form>
  );
}

// ─── Asistentes sin match ────────────────────────────────────────────────────

export interface UnmatchedRow {
  id: string;
  name: string | null;
  email: string;
  eventTitle: string;
  eventDate: string;
  /** Miembro que calza por nombre sin ambigüedad (queda pre-seleccionado). */
  suggestedMemberId: string | null;
}

/**
 * Filas del import que no calzaron con ningún miembro (se inscribieron con
 * otro correo). Elegir el miembro y «Enlazar» acredita asistencia, puntos y
 * aviso igual que un match automático.
 */
export function UnmatchedAttendance({
  rows,
  members,
}: {
  rows: UnmatchedRow[];
  members: Array<{ id: string; full_name: string }>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (row) => !done.has(row.id) && (!q || `${row.name ?? ""} ${row.email}`.toLowerCase().includes(q))
  );
  // Los que calzan por nombre van primero: son un clic.
  const shown = [...visible].sort((a, b) => Number(Boolean(b.suggestedMemberId)) - Number(Boolean(a.suggestedMemberId))).slice(0, 40);

  const link = (row: UnmatchedRow) => {
    const memberId = choice[row.id] ?? row.suggestedMemberId ?? "";
    if (!memberId) return setError("Elige el miembro primero.");
    setError(null);
    startTransition(async () => {
      const result = await linkAttendance(row.id, memberId);
      if (!result.ok) return setError(result.error ?? "No pudimos enlazar.");
      setDone((prev) => new Set(prev).add(row.id));
      router.refresh();
    });
  };

  if (visible.length === 0 && !q) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/50">{visible.length} asistentes sin miembro enlazado</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="w-full max-w-xs rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs outline-none placeholder:text-white/25 focus:border-stride-cyan"
        />
      </div>
      {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
      <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-black/20">
        {shown.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white/85">{row.name ?? "(sin nombre)"}</p>
              <p className="truncate text-[11px] text-white/40">
                {row.email} · {row.eventDate} · {row.eventTitle}
              </p>
            </div>
            <select
              value={choice[row.id] ?? row.suggestedMemberId ?? ""}
              onChange={(e) => setChoice((prev) => ({ ...prev, [row.id]: e.target.value }))}
              className="rounded-xl border border-white/15 bg-stride-card px-2.5 py-1.5 text-xs outline-none"
            >
              <option value="">Miembro…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={() => link(row)}
              className={`rounded-full px-4 py-1.5 font-heading text-xs font-bold transition disabled:opacity-50 ${
                row.suggestedMemberId ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "border border-white/15 text-white/70 hover:bg-white/5"
              }`}
            >
              {row.suggestedMemberId ? "Enlazar · calza por nombre" : "Enlazar"}
            </button>
          </li>
        ))}
      </ul>
      {visible.length > shown.length && (
        <p className="text-[11px] text-white/35">
          Mostrando {shown.length} de {visible.length}: usa el buscador para encontrar a alguien.
        </p>
      )}
    </div>
  );
}
