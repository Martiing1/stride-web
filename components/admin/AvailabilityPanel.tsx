"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, HelpCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { respondAvailability } from "@/app/admin/eventos/actions";
import type { TeamMember } from "@/lib/types";

type Response = "si" | "no" | "tal_vez";

const OPTIONS: { value: Response; label: string; icon: typeof Check; style: string }[] = [
  { value: "si", label: "Voy", icon: Check, style: "bg-emerald-500 text-white" },
  { value: "tal_vez", label: "Tal vez", icon: HelpCircle, style: "bg-amber-500 text-white" },
  { value: "no", label: "No puedo", icon: X, style: "bg-red-500 text-white" },
];

/**
 * Encuesta de disponibilidad del equipo.
 *
 * Reemplaza la encuesta manual de WhatsApp del domingo: cada persona marca su
 * respuesta y el panel muestra en vivo si se alcanza el mínimo para que el
 * Social Run se realice.
 */
export function AvailabilityPanel({
  eventId,
  minConfirmations,
  confirmedCount,
  maybeCount,
  declinedCount,
  meetsMinimum,
  team,
  responses,
  currentMemberId,
}: {
  eventId: string;
  minConfirmations: number;
  confirmedCount: number;
  maybeCount: number;
  declinedCount: number;
  meetsMinimum: boolean;
  team: TeamMember[];
  responses: Record<string, Response>;
  currentMemberId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const myResponse = responses[currentMemberId];
  const pendientes = team.filter((t) => !responses[t.id]);

  function respond(response: Response) {
    const form = new FormData();
    form.set("event_id", eventId);
    form.set("response", response);

    startTransition(async () => {
      const res = await respondAvailability(form);
      if (!res.ok) setError(res.error ?? "No se pudo registrar.");
      router.refresh();
    });
  }

  return (
    <section className="space-y-5">
      {/* Veredicto de la regla */}
      <div
        className={`card flex flex-wrap items-center gap-5 ${
          meetsMinimum ? "border-emerald-500/40" : "border-amber-500/40"
        }`}
      >
        {meetsMinimum ? (
          <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-400" />
        ) : (
          <AlertTriangle className="h-9 w-9 shrink-0 text-amber-400" />
        )}

        <div className="min-w-[200px] flex-1">
          <p className="font-heading text-xl font-bold text-white">
            {meetsMinimum ? "El evento se puede realizar" : "Faltan confirmaciones"}
          </p>
          <p className="mt-0.5 text-sm text-white/55">
            {confirmedCount} de {minConfirmations} confirmados
            {maybeCount > 0 && ` · ${maybeCount} tal vez`}
            {declinedCount > 0 && ` · ${declinedCount} no pueden`}
          </p>
        </div>

        <div className="font-heading text-4xl font-extrabold text-white">
          {confirmedCount}
          <span className="text-lg text-white/30">/{minConfirmations}</span>
        </div>
      </div>

      {/* Mi respuesta */}
      <div className="card">
        <p className="label">¿Vas a este evento?</p>
        <div className="flex flex-wrap gap-2">
          {OPTIONS.map(({ value, label, icon: Icon, style }) => (
            <button
              key={value}
              type="button"
              disabled={pending}
              onClick={() => respond(value)}
              aria-pressed={myResponse === value}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                myResponse === value
                  ? style
                  : "border border-white/15 text-white/60 hover:border-white/35 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {/* Respuestas del equipo */}
      <div className="card">
        <p className="mb-4 font-heading text-sm font-bold uppercase tracking-wide text-white/70">
          Equipo
        </p>
        <ul className="space-y-1.5">
          {team.map((person) => {
            const response = responses[person.id];
            const option = OPTIONS.find((o) => o.value === response);

            return (
              <li key={person.id} className="flex items-center justify-between gap-3 py-1">
                <span className="truncate text-sm text-white/80">
                  {person.nickname ?? person.full_name}
                </span>

                {option ? (
                  <span
                    className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${
                      response === "si"
                        ? "text-emerald-400"
                        : response === "tal_vez"
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                  >
                    <option.icon className="h-3.5 w-3.5" />
                    {option.label}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-white/25">Sin responder</span>
                )}
              </li>
            );
          })}
        </ul>

        {pendientes.length > 0 && (
          <p className="mt-4 border-t border-white/5 pt-3 text-xs text-white/40">
            Faltan {pendientes.length} por responder:{" "}
            {pendientes.map((p) => p.nickname ?? p.full_name).join(", ")}
          </p>
        )}
      </div>
    </section>
  );
}
