"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, EyeOff } from "lucide-react";
import { setEventStatus } from "@/app/admin/eventos/actions";
import type { EventStatus } from "@/lib/types";

const STATUSES: { value: EventStatus; label: string }[] = [
  { value: "planificacion", label: "Planificación" },
  { value: "encuesta_abierta", label: "Encuesta abierta" },
  { value: "confirmado", label: "Confirmado" },
  { value: "completado", label: "Completado" },
  { value: "cancelado", label: "Cancelado" },
];

/** Control del estado del evento y de su publicación en la web pública. */
export function EventStatusControls({
  eventId,
  status,
  isPublic,
  hasEventlyUrl,
  meetsMinimum,
}: {
  eventId: string;
  status: EventStatus;
  isPublic: boolean;
  hasEventlyUrl: boolean;
  meetsMinimum: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(next: { status?: EventStatus; is_public?: boolean }) {
    const form = new FormData();
    form.set("id", eventId);
    form.set("status", next.status ?? status);
    if (next.is_public !== undefined) form.set("is_public", String(next.is_public));

    startTransition(async () => {
      const res = await setEventStatus(form);
      setError(res.ok ? null : (res.error ?? "No se pudo actualizar."));
      router.refresh();
    });
  }

  const canPublish = status === "confirmado" && hasEventlyUrl;

  return (
    <section className="card space-y-5">
      <div>
        <label className="label" htmlFor="event-status">
          Estado del evento
        </label>
        <select
          id="event-status"
          value={status}
          disabled={pending}
          onChange={(e) => update({ status: e.target.value as EventStatus })}
          className="input w-auto"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value} className="bg-stride-card">
              {s.label}
            </option>
          ))}
        </select>

        {status === "encuesta_abierta" && meetsMinimum && (
          <p className="mt-2 text-sm text-emerald-400">
            Ya hay suficientes confirmados: puedes pasarlo a Confirmado.
          </p>
        )}
      </div>

      <div className="border-t border-white/5 pt-5">
        <p className="label">Publicación en stridechile.cl</p>

        {isPublic ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <Globe className="h-4 w-4" /> Visible en /eventos
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => update({ is_public: false })}
              className="btn-secondary px-4 py-2 text-sm"
            >
              <EyeOff className="h-4 w-4" /> Quitar de la web
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              disabled={pending || !canPublish}
              onClick={() => update({ is_public: true })}
              className="btn-primary px-5 py-2 text-sm"
            >
              <Globe className="h-4 w-4" /> Publicar en la web
            </button>
            {!canPublish && (
              <p className="text-xs text-white/40">
                {!hasEventlyUrl
                  ? "Necesita su link de Evently para poder publicarse."
                  : "Solo se publican los eventos confirmados."}
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
