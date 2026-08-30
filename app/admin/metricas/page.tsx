import { BarChart3, CalendarDays, Percent, Users } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateCL } from "@/lib/membership";
import type { StrideEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Métricas Social Run" };

// Paleta validada del sistema de visualización (modo oscuro): identidad fija.
const C_INSCRITOS = "#3987e5";
const C_ASISTENTES = "#d95926";

interface Reg {
  event_id: string;
  email: string | null;
  first_name: string;
  last_name: string | null;
  validated_at: string | null;
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default async function MetricasPage() {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const supabase = await createClient();

  const [{ data: eventsData }, { data: regsData }] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .like("event_type", "social_run%")
      .in("status", ["confirmado", "completado"])
      .order("event_date"),
    supabase.from("event_registrations").select("event_id, email, first_name, last_name, validated_at"),
  ]);
  const events = (eventsData ?? []) as StrideEvent[];
  const regs = (regsData ?? []) as Reg[];

  const byEvent = new Map<string, Reg[]>();
  for (const r of regs) byEvent.set(r.event_id, [...(byEvent.get(r.event_id) ?? []), r]);

  const rows = events
    .map((event) => {
      const list = byEvent.get(event.id) ?? [];
      const attended = list.filter((r) => r.validated_at).length;
      return { event, registered: list.length, attended, rate: list.length ? attended / list.length : null };
    })
    .filter((r) => r.registered > 0 || r.event.status === "completado");

  // Agregado mes a mes
  const monthly = new Map<string, { registered: number; attended: number; events: number }>();
  for (const r of rows) {
    const key = r.event.event_date.slice(0, 7);
    const agg = monthly.get(key) ?? { registered: 0, attended: 0, events: 0 };
    agg.registered += r.registered;
    agg.attended += r.attended;
    agg.events += 1;
    monthly.set(key, agg);
  }
  const months = Array.from(monthly.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  const maxMonthly = Math.max(1, ...months.map(([, m]) => m.registered));

  // Quiénes más van (por email validado)
  const people = new Map<string, { name: string; count: number }>();
  for (const r of regs) {
    if (!r.validated_at) continue;
    const key = (r.email ?? `${r.first_name} ${r.last_name}`).toLowerCase();
    const entry = people.get(key) ?? { name: `${r.first_name} ${r.last_name ?? ""}`.trim(), count: 0 };
    entry.count += 1;
    people.set(key, entry);
  }
  const top = Array.from(people.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  const maxTop = Math.max(1, ...top.map((t) => t.count));

  const withData = rows.filter((r) => r.registered > 0);
  const totalAttended = withData.reduce((s, r) => s + r.attended, 0);
  const avgRate = withData.length
    ? Math.round((withData.reduce((s, r) => s + (r.rate ?? 0), 0) / withData.length) * 100)
    : null;

  return (
    <div className="space-y-8">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
          <BarChart3 className="h-3.5 w-3.5" /> Métricas
        </p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">Social Runs en números</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          Inscritos contra asistencia real (validación en puerta de Evently). Importa el .xlsx
          de cada evento para alimentar esto.
        </p>
      </header>

      {/* Tiles */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Eventos con datos", value: String(withData.length), icon: CalendarDays },
          { label: "Asistencias registradas", value: String(totalAttended), icon: Users },
          { label: "Asistencia promedio", value: avgRate != null ? `${avgRate}%` : "—", icon: Percent },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card">
            <Icon className="h-5 w-5 text-white/30" />
            <p className="mt-3 font-heading text-3xl font-extrabold text-white">{value}</p>
            <p className="mt-1 text-sm text-white/45">{label}</p>
          </div>
        ))}
      </section>

      {/* Mes a mes */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-white">Mes a mes</h2>
          <div className="flex items-center gap-4 text-xs text-white/55">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_INSCRITOS }} /> Inscritos</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_ASISTENTES }} /> Asistieron</span>
          </div>
        </div>

        {months.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/40">Aún no hay imports de Evently. Sube el primero desde la ficha de un evento.</p>
        ) : (
          <div className="space-y-3">
            {months.map(([key, m]) => {
              const [y, mm] = key.split("-");
              const label = `${MONTHS[Number(mm) - 1]} ${y.slice(2)}`;
              const rate = m.registered ? Math.round((m.attended / m.registered) * 100) : 0;
              return (
                <div key={key} className="grid grid-cols-[64px_1fr_84px] items-center gap-3" title={`${label}: ${m.registered} inscritos, ${m.attended} asistieron (${rate}%) en ${m.events} evento${m.events === 1 ? "" : "s"}`}>
                  <span className="text-xs font-semibold text-white/55">{label}</span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-4 rounded-r" style={{ width: `${(m.registered / maxMonthly) * 100}%`, background: C_INSCRITOS, minWidth: 2 }} />
                      <span className="text-[11px] text-white/60">{m.registered}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-4 rounded-r" style={{ width: `${(m.attended / maxMonthly) * 100}%`, background: C_ASISTENTES, minWidth: 2 }} />
                      <span className="text-[11px] text-white/60">{m.attended}</span>
                    </div>
                  </div>
                  <span className="text-right text-xs text-white/45">{rate}% fue</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Por evento */}
        <section className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-white">Por evento</h2>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">Sin eventos con datos todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-white/35">
                    <th className="pb-2 pr-3 font-medium">Evento</th>
                    <th className="pb-2 pr-3 text-right font-medium">Inscritos</th>
                    <th className="pb-2 pr-3 text-right font-medium">Fueron</th>
                    <th className="pb-2 text-right font-medium">Tasa</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map(({ event, registered, attended, rate }) => (
                    <tr key={event.id} className="border-t border-white/5">
                      <td className="py-2.5 pr-3">
                        <a href={`/admin/eventos/${event.id}`} className="text-white hover:text-stride-cyan">{event.title}</a>
                        <span className="block text-[11px] text-white/35">{formatDateCL(event.event_date)}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-white/70">{registered || "—"}</td>
                      <td className="py-2.5 pr-3 text-right text-white/70">{attended || "—"}</td>
                      <td className="py-2.5 text-right font-semibold text-white">{rate != null ? `${Math.round(rate * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Quiénes más van */}
        <section className="card space-y-4">
          <h2 className="font-heading text-lg font-bold text-white">Quiénes más van</h2>
          {top.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">Se llena con los imports de Evently.</p>
          ) : (
            <ul className="space-y-2">
              {top.map((person) => (
                <li key={person.name} className="grid grid-cols-[1fr_auto] items-center gap-3" title={`${person.name}: ${person.count} asistencia${person.count === 1 ? "" : "s"}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{person.name}</p>
                    <div className="mt-1 h-3 rounded-r" style={{ width: `${(person.count / maxTop) * 100}%`, background: C_INSCRITOS, minWidth: 2 }} />
                  </div>
                  <span className="text-sm font-semibold text-white/70">{person.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
