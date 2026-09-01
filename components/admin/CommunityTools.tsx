"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  createChallenge,
  toggleChallenge,
  savePointsWeights,
  importEventlyCsv,
} from "@/app/admin/comunidad/actions";
import { DEFAULT_POINTS, type PointsWeights } from "@/lib/community-shared";

// ─── Crear / listar retos ────────────────────────────────────────────────────

export interface AdminChallenge {
  id: string;
  title: string;
  period: string;
  criterio: string;
  goal: number;
  points: number;
  active: boolean;
  medal_name: string | null;
}

export function ChallengeManager({
  challenges,
  medals,
}: {
  challenges: AdminChallenge[];
  medals: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    setError(null);
    setOk(false);
    startTransition(async () => {
      const result = await createChallenge(formData);
      if (!result.ok) return setError(result.error ?? "No pudimos crear el reto.");
      setOk(true);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <form action={submit} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="font-heading text-sm font-bold">Nuevo reto</p>
        <input name="title" placeholder="Título (ej: 12 entrenamientos en septiembre)" required
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-stride-cyan" />
        <textarea name="description" placeholder="Descripción corta (opcional)"
          className="min-h-16 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-stride-cyan" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-xs text-white/50">
            Período
            <select name="period" className="mt-1 w-full rounded-xl border border-white/15 bg-stride-card px-3 py-2.5 text-sm outline-none">
              <option value="mes">Del mes</option>
              <option value="semana">Micro (semana)</option>
              <option value="general">General</option>
              <option value="hito">Hito (permanente)</option>
            </select>
          </label>
          <label className="text-xs text-white/50">
            Criterio
            <select name="criterio" className="mt-1 w-full rounded-xl border border-white/15 bg-stride-card px-3 py-2.5 text-sm outline-none">
              <option value="cantidad">Cantidad (autoreporte)</option>
              <option value="evidencia">Evidencia (verifican)</option>
              <option value="asistencia">Asistencia (Evently)</option>
            </select>
          </label>
          <label className="text-xs text-white/50">
            Meta
            <input name="goal" type="number" min={1} defaultValue={1}
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none" />
          </label>
          <label className="text-xs text-white/50">
            Puntos
            <input name="points" type="number" min={0} defaultValue={15}
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none" />
          </label>
        </div>
        <label className="block text-xs text-white/50">
          Medalla al cumplir (opcional)
          <select name="medal_id" className="mt-1 w-full rounded-xl border border-white/15 bg-stride-card px-3 py-2.5 text-sm outline-none">
            <option value="">Sin medalla</option>
            {medals.map((medal) => (
              <option key={medal.id} value={medal.id}>{medal.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">
          {pending ? "Creando…" : "Crear reto"}
        </button>
        {ok && <span className="ml-3 text-sm font-semibold text-emerald-300">Reto creado ✓</span>}
        {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
      </form>

      <div className="space-y-2">
        {challenges.map((challenge) => (
          <div key={challenge.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className={clsx("font-heading text-sm font-bold", !challenge.active && "text-white/40 line-through")}>
                {challenge.title}
              </p>
              <p className="text-xs text-white/45">
                {challenge.period} · {challenge.criterio} · meta {challenge.goal} · +{challenge.points} pts
                {challenge.medal_name ? ` · 🏅 ${challenge.medal_name}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await toggleChallenge(challenge.id, !challenge.active);
                  router.refresh();
                })
              }
              className={clsx(
                "rounded-full px-4 py-1.5 text-xs font-bold transition",
                challenge.active
                  ? "border border-white/20 text-white/60 hover:bg-white/5"
                  : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
              )}
            >
              {challenge.active ? "Desactivar" : "Activar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Config de puntos ────────────────────────────────────────────────────────

const POINT_LABELS: Record<keyof PointsWeights, string> = {
  post: "Publicar en el blog",
  comment: "Comentar",
  like_received: "Like recibido",
  social_run: "Asistir a un Social Run",
  sesion_online: "Asistir a sesión online",
  habitos_dia: "Completar hábitos del día",
  reto_mes: "Reto del mes",
  micro_reto: "Micro-reto semanal",
  reto_general: "Reto general",
  hito: "Hito",
};

export function PointsConfigForm({ initial }: { initial: PointsWeights }) {
  const router = useRouter();
  const [values, setValues] = useState<PointsWeights>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(DEFAULT_POINTS) as Array<keyof PointsWeights>).map((key) => (
          <label key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            {POINT_LABELS[key]}
            <input
              type="number"
              min={0}
              max={1000}
              value={values[key]}
              onChange={(e) => {
                setSaved(false);
                setValues({ ...values, [key]: Number(e.target.value) });
              }}
              className="w-20 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-right text-sm font-bold outline-none focus:border-stride-cyan"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await savePointsWeights(values);
            if (!result.ok) return setError(result.error ?? "Error al guardar.");
            setError(null);
            setSaved(true);
            router.refresh();
          })
        }
        className="btn-primary px-6 py-2.5 text-sm disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar configuración"}
      </button>
      {saved && <span className="ml-3 text-sm font-semibold text-emerald-300">Guardado ✓</span>}
      {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
    </div>
  );
}

// ─── Import Evently ──────────────────────────────────────────────────────────

export function EventlyImport({ events }: { events: Array<{ id: string; title: string; event_date: string }> }) {
  const router = useRouter();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [pending, startTransition] = useTransition();

  const readFile = (file: File | null) => {
    if (!file) return;
    void file.text().then(setCsv);
  };

  const submit = (formData: FormData) => {
    setError(null);
    setSummary(null);
    formData.set("csv", csv);
    startTransition(async () => {
      const result = await importEventlyCsv(formData);
      if (!result.ok) return setError(result.error ?? "No pudimos importar.");
      setSummary(result.summary ?? "Importado.");
      setCsv("");
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
        CSV de Evently (súbelo o pégalo)
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => readFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-xs text-white/60 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white"
        />
      </label>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={"nombre,email\nIsabel Molina,isabel@mail.com"}
        className="min-h-28 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 font-mono text-xs outline-none placeholder:text-white/25 focus:border-stride-cyan"
      />
      <button type="submit" disabled={pending || !csv.trim()} className="btn-primary px-6 py-2.5 text-sm disabled:opacity-60">
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
