import { BarChart3, CalendarDays, Percent, Users, Star, IdCard, ScanLine, UserPlus } from "lucide-react";
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

interface EvalRow {
  event_id: string;
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

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default async function MetricasPage() {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const supabase = await createClient();

  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
  const [{ data: eventsData }, { data: regsData }, { data: evalsData }, { data: membersData }, { count: scansMonth }, { data: leadsData }] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .like("event_type", "social_run%")
      .in("status", ["confirmado", "completado"])
      .order("event_date"),
    supabase.from("event_registrations").select("event_id, email, first_name, last_name, validated_at"),
    supabase.from("event_evaluations").select("event_id, attended, rating_overall, rating_team, rating_safety, rating_timing, improvements, highlights"),
    supabase.from("members").select("status, valid_until, joined_at, invitation_status"),
    supabase.from("scans").select("id", { count: "exact", head: true }).gte("scanned_at", `${monthStart}T00:00:00`),
    supabase.from("leads").select("status, created_at"),
  ]);
  const events = (eventsData ?? []) as StrideEvent[];
  const regs = (regsData ?? []) as Reg[];
  const evals = (evalsData ?? []) as EvalRow[];
  const evalsByEvent = new Map<string, EvalRow[]>();
  for (const e of evals) evalsByEvent.set(e.event_id, [...(evalsByEvent.get(e.event_id) ?? []), e]);
  const evalAvg = (eventId: string) => {
    const vals = (evalsByEvent.get(eventId) ?? []).filter((e) => e.attended).map((e) => e.rating_overall).filter((v): v is number => v != null);
    return vals.length ? avg(vals) : null;
  };

  // ── Membresía ──
  const today = new Date().toISOString().slice(0, 10);
  const members = (membersData ?? []) as Array<{ status: string; valid_until: string | null; joined_at: string; invitation_status: string }>;
  const activos = members.filter((m) => m.status === "activa" && (!m.valid_until || m.valid_until >= today)).length;
  const nuevosMes = members.filter((m) => m.joined_at >= monthStart).length;
  const activados = members.filter((m) => m.invitation_status === "activada").length;
  const leads = (leadsData ?? []) as Array<{ status: string; created_at: string }>;
  const leadsMes = leads.filter((l) => l.created_at >= monthStart).length;
  const convertidos = leads.filter((l) => l.status === "convertido").length;
  const conversion = leads.length ? Math.round((convertidos / leads.length) * 100) : null;

  const byEvent = new Map<string, Reg[]>();
  for (const r of regs) byEvent.set(r.event_id, [...(byEvent.get(r.event_id) ?? []), r]);

  const rows = events
    .map((event) => {
      const list = byEvent.get(event.id) ?? [];
      const attended = list.filter((r) => r.validated_at).length;
      return { event, registered: list.length, attended, rate: list.length ? attended / list.length : null };
    })
    .filter((r) => r.registered > 0 || r.event.status === "completado" || evalsByEvent.has(r.event.id));

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
          Membresía, inscritos contra asistencia real (validación en puerta de Evently) y las
          evaluaciones del equipo. Importa el .xlsx de cada evento para alimentar esto.
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

      {/* Membresía */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white"><IdCard className="h-5 w-5 text-stride-cyan" /> Membresía</h2>
          <span className="text-xs text-white/40">Este mes desde el {monthStart.split("-").reverse().join("/")}</span>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Miembros vigentes", String(activos), IdCard],
            ["Nuevos este mes", String(nuevosMes), UserPlus],
            ["Ya entraron a la plataforma", `${activados}/${members.length}`, Users],
            ["Escaneos QR del mes", String(scansMonth ?? 0), ScanLine],
            ["Leads del mes", String(leadsMes), UserPlus],
            ["Conversión leads → miembro", conversion != null ? `${conversion}%` : "—", Percent],
          ].map(([label, value, Icon]) => {
            const I = Icon as typeof IdCard;
            return (
              <div key={label as string} className="rounded-xl bg-white/[0.03] p-3">
                <I className="h-4 w-4 text-white/30" />
                <dd className="mt-2 font-heading text-2xl font-extrabold text-white">{value as string}</dd>
                <dt className="mt-0.5 text-[11px] text-white/45">{label as string}</dt>
              </div>
            );
          })}
        </dl>
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
                    <th className="pb-2 pr-3 text-right font-medium">Tasa</th>
                    <th className="pb-2 text-right font-medium">Evaluación</th>
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
                      <td className="py-2.5 pr-3 text-right font-semibold text-white">{rate != null ? `${Math.round(rate * 100)}%` : "—"}</td>
                      <td className="py-2.5 text-right text-white/70">{evalAvg(event.id) ? <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 text-stride-amber" />{evalAvg(event.id)}</span> : "—"}</td>
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

      {/* Evaluaciones del equipo (antes módulo aparte) */}
      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white"><Star className="h-5 w-5 text-stride-amber" /> Evaluaciones del equipo</h2>
        {evals.length === 0 ? (
          <p className="py-4 text-sm text-white/40">Cuando el equipo evalúe el próximo social run, acá aparece el promedio por evento y lo que dijeron.</p>
        ) : (
          <div className="space-y-3">
            {[...events].reverse().filter((e) => evalsByEvent.has(e.id)).slice(0, 8).map((event) => {
              const rows = (evalsByEvent.get(event.id) ?? []);
              const att = rows.filter((r) => r.attended);
              const notes = rows.flatMap((r) => [r.improvements, r.highlights]).filter((v): v is string => Boolean(v));
              return (
                <article key={event.id} className="rounded-xl border border-white/5 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a href={`/admin/eventos/${event.id}`} className="font-heading font-bold text-white hover:text-stride-cyan">{event.title}</a>
                    <span className="text-xs text-white/40">{formatDateCL(event.event_date)} · {rows.length} {rows.length === 1 ? "respuesta" : "respuestas"}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                    {[
                      ["General", att.map((r) => r.rating_overall)],
                      ["Equipo", att.map((r) => r.rating_team)],
                      ["Seguridad", att.map((r) => r.rating_safety)],
                      ["Tiempos", att.map((r) => r.rating_timing)],
                    ].map(([label, vals]) => (
                      <div key={label as string} className="rounded-lg bg-white/[0.03] p-2">
                        <dt className="text-[10px] uppercase tracking-wide text-white/35">{label as string}</dt>
                        <dd className="font-heading text-lg font-bold text-white">{avg((vals as Array<number | null>).filter((v): v is number => v != null))}</dd>
                      </div>
                    ))}
                  </dl>
                  {notes.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-white/5 pt-3">
                      {notes.slice(0, 4).map((n, i) => <li key={i} className="text-xs leading-relaxed text-white/55">· {n}</li>)}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
