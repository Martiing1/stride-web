import Link from "next/link";
import { ClipboardList, CalendarDays, Check, CircleDashed } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/membership";
import type { StrideEvent, EventPlan } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, string> = {
  borrador: "bg-white/10 text-white/55",
  lista: "bg-emerald-500/15 text-emerald-400",
  ejecutada: "bg-stride-indigo/20 text-stride-indigo",
};

export default async function PlanificacionesPage() {
  await requireTeamMember();
  const supabase = await createClient();
  const today = todayInChile();

  const [{ data: eventsData }, { data: plansData }] = await Promise.all([
    supabase.from("events").select("*").order("event_date", { ascending: false }).limit(40),
    supabase.from("event_plans").select("*"),
  ]);

  const events = (eventsData ?? []) as StrideEvent[];
  const plans = new Map(((plansData ?? []) as EventPlan[]).map((p) => [p.event_id, p]));

  const upcoming = events.filter((e) => e.event_date >= today);
  const past = events.filter((e) => e.event_date < today);

  const row = (event: StrideEvent, dim = false) => {
    const plan = plans.get(event.id);
    return (
      <li key={event.id}>
        <Link
          href={`/admin/planificaciones/${event.id}`}
          className={`card flex flex-wrap items-center gap-4 transition hover:border-white/20 ${dim ? "opacity-60" : ""}`}
        >
          <div className="min-w-[180px] flex-1">
            <p className="font-medium text-white">{event.title}</p>
            <p className="mt-0.5 text-xs text-white/40">
              {event.event_date.split("-").reverse().join("/")}
              {event.meeting_point && ` · ${event.meeting_point}`}
            </p>
          </div>

          {plan ? (
            <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONES[plan.status]}`}>
              <Check className="h-3 w-3" />
              {plan.status}
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-stride-amber/15 px-2.5 py-1 text-xs font-semibold text-stride-amber">
              <CircleDashed className="h-3 w-3" />
              Sin planificar
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Planificaciones</h1>
        <p className="mt-1 max-w-2xl text-white/50">
          La planificación de cada Social Run: ruta, roles en terreno, rompehielo, materiales y
          plan B. Se llena acá y queda visible para todo el equipo.
        </p>
      </header>

      <section>
        <h2 className="mb-4 font-heading text-xl font-bold text-white">Próximos</h2>
        {upcoming.length > 0 ? (
          <ul className="space-y-2">{upcoming.map((e) => row(e))}</ul>
        ) : (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <CalendarDays className="h-9 w-9 text-white/25" />
            <p className="text-sm text-white/50">
              No hay eventos próximos. Crea uno en Eventos y aparecerá acá para planificar.
            </p>
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-4 font-heading text-xl font-bold text-white">Pasados</h2>
          <ul className="space-y-2">{past.slice(0, 12).map((e) => row(e, true))}</ul>
        </section>
      )}

      {events.length === 0 && (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <ClipboardList className="h-10 w-10 text-white/25" />
          <p className="font-heading text-lg font-bold text-white">Nada que planificar todavía</p>
        </div>
      )}
    </div>
  );
}
