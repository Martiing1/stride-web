"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { staffDeleteChallenge, staffSaveChallenge, staffToggleChallenge } from "@/app/miembros/community-actions";
import type { AdminChallengeRow, MedalOption } from "@/lib/community";

const PERIOD_LABELS: Record<string, string> = {
  mes: "Reto del mes",
  semana: "Micro-reto",
  general: "Reto general",
  hito: "Hito permanente",
};

const CRITERIO_LABELS: Record<string, string> = {
  cantidad: "Autoreporte (+1)",
  asistencia: "Asistencia a Social Runs",
  evidencia: "Evidencia (verifica el staff)",
};

interface ChallengeDraft {
  id?: string;
  title: string;
  description: string;
  period: string;
  criterio: string;
  goal: string;
  points: string;
  medal_id: string;
  /** YYYY-MM; solo aplica a retos del mes y micro-retos. */
  month: string;
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

const EMPTY: ChallengeDraft = {
  title: "",
  description: "",
  period: "mes",
  criterio: "cantidad",
  goal: "1",
  points: "0",
  medal_id: "",
  month: "",
};

const field =
  "w-full rounded-xl border border-[var(--sline2)] bg-[var(--scard2)] px-3 py-2 text-sm text-[var(--stext)] outline-none focus:border-stride-accent";
const label = "block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--sdim)]";

/**
 * Gestión de retos para el staff, dentro de la propia sección Retos:
 * crear, editar, activar/desactivar y eliminar.
 */
export function ChallengeAdminPanel({ challenges, medals }: { challenges: AdminChallengeRow[]; medals: MedalOption[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ChallengeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openEdit = (c: AdminChallengeRow) =>
    setDraft({
      id: c.id,
      title: c.title,
      description: c.description ?? "",
      period: c.period,
      criterio: c.criterio,
      goal: String(c.goal),
      points: String(c.points),
      medal_id: c.medal_id ?? "",
      month: c.month?.slice(0, 7) ?? "",
    });

  const submit = () => {
    if (!draft) return;
    const data = new FormData();
    for (const [key, value] of Object.entries(draft)) data.set(key, value ?? "");
    startTransition(async () => {
      const result = await staffSaveChallenge(data);
      if (!result.ok) return setError(result.error ?? "No pudimos guardar.");
      setDraft(null);
      setError(null);
      router.refresh();
    });
  };

  const toggle = (c: AdminChallengeRow) => {
    startTransition(async () => {
      await staffToggleChallenge(c.id, !c.active);
      router.refresh();
    });
  };

  const remove = (challengeId: string) => {
    if (!window.confirm("¿Eliminar este reto? Se borra también el avance de todos los miembros.")) return;
    startTransition(async () => {
      await staffDeleteChallenge(challengeId);
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-stride-accent/35 bg-[var(--scard)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-heading text-sm font-bold">
          <span className="rounded-full bg-stride-accent px-2 py-0.5 text-[10px] font-bold uppercase text-white">Admin</span>
          Gestionar retos
        </h2>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY, month: currentMonth() })}
          className="flex items-center gap-1.5 rounded-full bg-stride-accent px-3.5 py-1.5 font-heading text-xs font-bold text-white transition hover:bg-stride-accentDark"
        >
          <Plus className="h-3.5 w-3.5" /> Crear reto
        </button>
      </div>

      {challenges.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {challenges.map((c) => (
            <div key={c.id} className={clsx("flex items-center gap-2 rounded-xl bg-[var(--scard2)] px-3 py-2", !c.active && "opacity-55")}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-xs font-bold">{c.title}</p>
                <p className="text-[11px] text-[var(--sdim)]">
                  {PERIOD_LABELS[c.period]}
                  {c.month ? ` · ${c.month.slice(0, 7)}` : ""} · meta {c.goal} · {c.points} pts
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(c)}
                disabled={pending}
                className={clsx(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold transition",
                  c.active ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-[var(--shover)] text-[var(--sdim)] hover:text-[var(--stext)]"
                )}
              >
                {c.active ? "Activo" : "Inactivo"}
              </button>
              <button type="button" onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-[var(--smut)] transition hover:bg-[var(--shover)]" aria-label="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => remove(c.id)} disabled={pending} className="rounded-lg p-1.5 text-[var(--smut)] transition hover:bg-red-500/15 hover:text-red-400" aria-label="Eliminar">
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
              <h3 className="font-heading text-base font-bold">{draft.id ? "Editar reto" : "Crear reto"}</h3>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg p-1.5 text-[var(--smut)] hover:bg-[var(--shover)]" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className={label}>Título *</label>
                <input className={field} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Corre 3 veces esta semana" />
              </div>
              <div>
                <label className={label}>Descripción</label>
                <textarea className={field} rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Cómo se cumple, reglas, etc." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Tipo</label>
                  <select className={field} value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })}>
                    {Object.entries(PERIOD_LABELS).map(([value, text]) => (
                      <option key={value} value={value}>{text}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Cómo se cumple</label>
                  <select className={field} value={draft.criterio} onChange={(e) => setDraft({ ...draft, criterio: e.target.value })}>
                    {Object.entries(CRITERIO_LABELS).map(([value, text]) => (
                      <option key={value} value={value}>{text}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Meta (veces)</label>
                  <input className={field} type="number" min="1" value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} />
                </div>
                <div>
                  <label className={label}>Puntos al cumplir</label>
                  <input className={field} type="number" min="0" value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={label}>Medalla al cumplir (opcional)</label>
                <select className={field} value={draft.medal_id} onChange={(e) => setDraft({ ...draft, medal_id: e.target.value })}>
                  <option value="">Sin medalla</option>
                  {medals.map((m) => (
                    <option key={m.id} value={m.id}>{m.emoji} {m.name} ({m.rarity})</option>
                  ))}
                </select>
              </div>
              {(draft.period === "mes" || draft.period === "semana") && (
                <div>
                  <label className={label}>Mes del reto</label>
                  <input
                    className={field}
                    type="month"
                    value={draft.month || currentMonth()}
                    onChange={(e) => setDraft({ ...draft, month: e.target.value })}
                  />
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--sdim)]">
                    Solo se muestra a los miembros durante ese mes: puedes dejar listos los del próximo.
                  </p>
                </div>
              )}

              {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">{error}</p>}

              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="w-full rounded-full bg-stride-accent py-2.5 font-heading text-sm font-bold text-white transition hover:bg-stride-accentDark disabled:opacity-60"
              >
                {pending ? "Guardando…" : draft.id ? "Guardar cambios" : "Crear reto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
