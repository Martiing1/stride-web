import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Clock3, Star } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPendingEvaluations } from "@/lib/evaluations";
import { formatDateCL } from "@/lib/membership";
import type { StrideEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Evaluaciones" };

interface EvalRow {
  event_id: string;
  team_member_id: string;
  attended: boolean;
  rating_overall: number | null;
  rating_team: number | null;
  rating_safety: number | null;
  rating_timing: number | null;
  improvements: string | null;
  highlights: string | null;
}

const avg = (values: number[]) =>
  values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "—";

export default async function EvaluacionesPage() {
  const member = await requireTeamMember();
  const supabase = await createClient();

  const [pending, { data: eventsData }, { data: evalsData }] = await Promise.all([
    getPendingEvaluations(member.id),
    supabase
      .from("events")
      .select("*")
      .like("event_type", "social_run%")
      .in("status", ["confirmado", "completado"])
      .order("event_date", { ascending: false })
      .limit(24),
    supabase.from("event_evaluations").select("*"),
  ]);

  const events = (eventsData ?? []) as StrideEvent[];
  const evals = (evalsData ?? []) as EvalRow[];
  const byEvent = new Map<string, EvalRow[]>();
  for (const e of evals) {
    byEvent.set(e.event_id, [...(byEvent.get(e.event_id) ?? []), e]);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Evaluaciones</h1>
        <p className="mt-1 max-w-2xl text-white/50">
          Cada social run se evalúa por todo el equipo. Acá se junta el resultado para la
          revisión de fin de mes.
        </p>
      </header>

      {pending.length > 0 && (
        <section className="card border-amber-400/30 bg-amber-500/5">
          <p className="mb-3 flex items-center gap-2 font-heading font-bold text-amber-200">
            <Clock3 className="h-4 w-4" /> Tienes {pending.length === 1 ? "una evaluación pendiente" : `${pending.length} evaluaciones pendientes`}
          </p>
          <ul className="space-y-2">
            {pending.map((event) => (
              <li key={event.id}>
                <Link href={`/admin/evaluaciones/${event.id}`} className="text-sm text-stride-cyan hover:underline">
                  {event.title} · {formatDateCL(event.event_date)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length ? (
        <section className="space-y-4">
          {events.map((event) => {
            const rows = byEvent.get(event.id) ?? [];
            const attended = rows.filter((r) => r.attended);
            const mine = rows.find((r) => r.team_member_id === member.id);
            const notes = rows
              .flatMap((r) => [r.improvements, r.highlights])
              .filter((v): v is string => Boolean(v));
            return (
              <article key={event.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-lg font-bold text-white">{event.title}</h2>
                    <p className="text-sm text-white/40">{formatDateCL(event.event_date)} · {rows.length} {rows.length === 1 ? "respuesta" : "respuestas"}</p>
                  </div>
                  {mine ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Ya evaluaste
                    </span>
                  ) : (
                    <Link href={`/admin/evaluaciones/${event.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/70 hover:text-white">
                      <ClipboardCheck className="h-3.5 w-3.5" /> Evaluar
                    </Link>
                  )}
                </div>

                {attended.length > 0 && (
                  <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["General", attended.map((r) => r.rating_overall).filter((v): v is number => v != null)],
                      ["Equipo", attended.map((r) => r.rating_team).filter((v): v is number => v != null)],
                      ["Seguridad", attended.map((r) => r.rating_safety).filter((v): v is number => v != null)],
                      ["Tiempos", attended.map((r) => r.rating_timing).filter((v): v is number => v != null)],
                    ].map(([label, values]) => (
                      <div key={label as string} className="rounded-xl bg-white/[0.03] p-3 text-center">
                        <dt className="text-[11px] uppercase tracking-wide text-white/35">{label as string}</dt>
                        <dd className="mt-1 flex items-center justify-center gap-1 font-heading text-xl font-bold text-white">
                          <Star className="h-4 w-4 text-stride-amber" /> {avg(values as number[])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {notes.length > 0 && (
                  <ul className="mt-4 space-y-1.5 border-t border-white/5 pt-4">
                    {notes.slice(0, 6).map((note, i) => (
                      <li key={i} className="text-sm leading-relaxed text-white/55">· {note}</li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </section>
      ) : (
        <p className="card py-10 text-center text-sm text-white/40">
          Cuando ocurra el próximo social run, acá va a aparecer su evaluación.
        </p>
      )}
    </div>
  );
}
