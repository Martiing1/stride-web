"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { staffSavePoints } from "@/app/miembros/community-actions";
import type { PointsWeights } from "@/lib/community-shared";

const LABELS: Array<{ key: keyof PointsWeights; text: string }> = [
  { key: "post", text: "Publicar en el blog" },
  { key: "comment", text: "Comentar" },
  { key: "like_received", text: "Like recibido" },
  { key: "social_run", text: "Asistir a Social Run" },
  { key: "sesion_online", text: "Sesión online" },
  { key: "habitos_dia", text: "Hábitos del día completos" },
  { key: "reto_mes", text: "Reto del mes" },
  { key: "micro_reto", text: "Micro-reto" },
  { key: "reto_general", text: "Reto general" },
  { key: "hito", text: "Hito permanente" },
];

/**
 * Edición de los pesos de puntos para el staff, dentro del propio Ranking.
 * Aplica desde el momento en que se guarda (no recalcula puntos ya pagados).
 */
export function PointsAdminPanel({ initial }: { initial: PointsWeights }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(LABELS.map(({ key }) => [key, String(initial[key])]))
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const input = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)]));
    startTransition(async () => {
      const result = await staffSavePoints(input);
      if (!result.ok) return setError(result.error ?? "No pudimos guardar.");
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-stride-accent/35 bg-[var(--scard)] p-4">
      <h2 className="flex items-center gap-2 font-heading text-sm font-bold">
        <span className="rounded-full bg-stride-accent px-2 py-0.5 text-[10px] font-bold uppercase text-white">Admin</span>
        Puntos por acción
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--sdim)]">
        Los cambios aplican de aquí en adelante; lo ya sumado no se recalcula.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {LABELS.map(({ key, text }) => (
          <label key={key} className="block">
            <span className="block text-[11px] font-semibold text-[var(--smut)]">{text}</span>
            <input
              type="number"
              min="0"
              max="1000"
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[var(--sline2)] bg-[var(--scard2)] px-3 py-2 text-sm text-[var(--stext)] outline-none focus:border-stride-accent tabular-nums"
            />
          </label>
        ))}
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="mt-3 w-full rounded-full bg-stride-accent py-2.5 font-heading text-sm font-bold text-white transition hover:bg-stride-accentDark disabled:opacity-60"
      >
        {pending ? "Guardando…" : saved ? "Guardado ✓" : "Guardar puntos"}
      </button>
    </section>
  );
}
