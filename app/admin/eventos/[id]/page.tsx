import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Clock, Route, Ticket, Star, BarChart3, ClipboardCheck } from "lucide-react";
import { requireTeamMember, isStaff } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/membership";
import { AvailabilityPanel } from "@/components/admin/AvailabilityPanel";
import { EventStatusControls } from "@/components/admin/EventStatusControls";
import { EventRegistrationsPanel } from "@/components/admin/EventRegistrationsPanel";
import { EventDeleteButton } from "@/components/admin/EventDeleteButton";
import type { StrideEvent, EventConfirmationStatus, TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";

interface AvailabilityRow {
  team_member_id: string;
  response: "si" | "no" | "tal_vez";
}

interface EvalRow {
  team_member_id: string;
  attended: boolean;
  rating_overall: number | null;
  rating_team: number | null;
  rating_safety: number | null;
  rating_timing: number | null;
  highlights: string | null;
  improvements: string | null;
  incidents: string | null;
}

const avg = (values: number[]) =>
  values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "—";

export default async function EventoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const member = await requireTeamMember();
  const { id } = await params;
  const supabase = await createClient();
  const isSocio = member.role === "socio";

  const { data: eventData } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!eventData) notFound();

  const event = eventData as StrideEvent;
  const isPast = event.event_date < todayInChile();

  const [{ data: confData }, { data: teamData }, { data: availData }, regRows, { data: evalData }] = await Promise.all([
    supabase.from("event_confirmation_status").select("*").eq("event_id", id).maybeSingle(),
    supabase.from("team_members").select("*").eq("status", "activo").order("full_name"),
    supabase.from("event_availability").select("team_member_id, response").eq("event_id", id),
    supabase
      .from("event_registrations")
      .select("email, validated_at")
      .eq("event_id", id)
      .then(({ data, error }) => (error || !data ? null : data)),
    supabase.from("event_evaluations").select("*").eq("event_id", id),
  ]);

  const confirmation = confData as EventConfirmationStatus | null;
  const team = (teamData ?? []) as TeamMember[];
  const responses = new Map(
    ((availData ?? []) as AvailabilityRow[]).map((r) => [r.team_member_id, r.response])
  );
  const registrations = regRows
    ? { registered: regRows.length, validated: regRows.filter((r) => r.validated_at).length }
    : null;

  // ── Métricas del evento (solo pasados) ───────────────────────────────────
  // Primera vez = inscritos validados cuyo correo no aparece validado en
  // ningún evento anterior. Escaneos QR = usos de beneficios ese día.
  let metrics: { firstTimers: number; firstRate: number | null; scans: number } | null = null;
  if (isPast && isStaff(member.role)) {
    const service = createServiceClient();
    const attendedEmails = (regRows ?? [])
      .filter((r) => r.validated_at && r.email)
      .map((r) => (r.email as string).toLowerCase());
    const [{ data: previous }, { count: scans }] = await Promise.all([
      attendedEmails.length
        ? service
            .from("event_registrations")
            .select("email, events!inner(event_date)")
            .not("validated_at", "is", null)
            .lt("events.event_date", event.event_date)
            .in("email", attendedEmails)
        : Promise.resolve({ data: [] as Array<{ email: string | null }> }),
      service
        .from("scans")
        .select("id", { count: "exact", head: true })
        .gte("scanned_at", `${event.event_date}T00:00:00-04:00`)
        .lt("scanned_at", `${event.event_date}T23:59:59-04:00`),
    ]);
    const seen = new Set(((previous ?? []) as Array<{ email: string | null }>).map((r) => (r.email ?? "").toLowerCase()));
    const firstTimers = attendedEmails.filter((e) => !seen.has(e)).length;
    metrics = {
      firstTimers,
      firstRate: attendedEmails.length ? Math.round((firstTimers / attendedEmails.length) * 100) : null,
      scans: scans ?? 0,
    };
  }

  const evals = ((evalData ?? []) as EvalRow[]);
  const attendedEvals = evals.filter((e) => e.attended);
  const personName = (tid: string) => {
    const p = team.find((t) => t.id === tid);
    return p ? (p.nickname ?? p.full_name) : "Alguien del equipo";
  };

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/eventos"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Eventos
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-heading text-3xl font-extrabold text-white">{event.title}</h1>
          {isSocio && <EventDeleteButton eventId={event.id} title={event.title} />}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/50">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-white/30" />
            {event.event_date.split("-").reverse().join("/")}
            {event.event_time && ` · ${event.event_time.slice(0, 5)} hrs`}
          </span>

          {event.meeting_point && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-white/30" />
              {event.meeting_point_map_url ? (
                <a
                  href={event.meeting_point_map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-white/20 underline-offset-2 hover:text-white"
                >
                  {event.meeting_point}
                </a>
              ) : (
                event.meeting_point
              )}
            </span>
          )}

          {event.distance_km && (
            <span className="flex items-center gap-1.5">
              <Route className="h-4 w-4 text-white/30" />
              {event.distance_km} km
            </span>
          )}

          {event.evently_url && (
            <a
              href={event.evently_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-stride-accent hover:underline"
            >
              <Ticket className="h-4 w-4" /> Evently
            </a>
          )}

          {isStaff(member.role) && (
            <Link href={`/admin/planificaciones/${event.id}`} className="text-stride-cyan hover:underline">
              Ver planificación
            </Link>
          )}
        </div>
      </header>

      {/* ── Evento pasado: métricas + evaluaciones (vista admin) ── */}
      {isPast && isStaff(member.role) && (
        <section className="card space-y-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white">
            <BarChart3 className="h-5 w-5 text-stride-cyan" /> Métricas del evento
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Inscritos", registrations ? String(registrations.registered) : "—"],
              ["Asistieron", registrations ? String(registrations.validated) : "—"],
              ["Asistencia", registrations?.registered ? `${Math.round((registrations.validated / registrations.registered) * 100)}%` : "—"],
              ["Primera vez", metrics?.firstRate != null ? `${metrics.firstRate}% (${metrics.firstTimers})` : "—"],
              ["Escaneos QR", metrics ? String(metrics.scans) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/[0.03] p-3 text-center">
                <dt className="text-[11px] uppercase tracking-wide text-white/35">{label}</dt>
                <dd className="mt-1 font-heading text-xl font-bold text-white">{value}</dd>
              </div>
            ))}
          </dl>
          {!registrations?.registered && (
            <p className="text-xs text-white/35">Importa el .xlsx de Evently más abajo para llenar inscritos, asistencia y primera vez.</p>
          )}

          <div className="border-t border-white/5 pt-4">
            <h3 className="flex items-center gap-2 font-heading font-bold text-white">
              <ClipboardCheck className="h-4 w-4 text-stride-cyan" /> Evaluaciones del equipo
              <span className="text-xs font-normal text-white/40">· {evals.length} {evals.length === 1 ? "respuesta" : "respuestas"} ({attendedEvals.length} asistieron)</span>
            </h3>
            {attendedEvals.length > 0 ? (
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["General", attendedEvals.map((r) => r.rating_overall).filter((v): v is number => v != null)],
                  ["Equipo", attendedEvals.map((r) => r.rating_team).filter((v): v is number => v != null)],
                  ["Seguridad", attendedEvals.map((r) => r.rating_safety).filter((v): v is number => v != null)],
                  ["Tiempos", attendedEvals.map((r) => r.rating_timing).filter((v): v is number => v != null)],
                ].map(([label, values]) => (
                  <div key={label as string} className="rounded-xl bg-white/[0.03] p-3 text-center">
                    <dt className="text-[11px] uppercase tracking-wide text-white/35">{label as string}</dt>
                    <dd className="mt-1 flex items-center justify-center gap-1 font-heading text-xl font-bold text-white">
                      <Star className="h-4 w-4 text-stride-amber" /> {avg(values as number[])}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-white/40">Todavía nadie del equipo entrega su evaluación.</p>
            )}

            {/* Detalle persona a persona: solo socios */}
            {isSocio && evals.length > 0 && (
              <ul className="mt-4 space-y-2">
                {evals.map((e) => (
                  <li key={e.team_member_id} className="rounded-xl border border-white/5 p-3 text-sm">
                    <p className="font-semibold text-white">
                      {personName(e.team_member_id)}
                      <span className="ml-2 text-xs font-normal text-white/40">
                        {e.attended ? `General ${e.rating_overall ?? "—"} · Equipo ${e.rating_team ?? "—"} · Seguridad ${e.rating_safety ?? "—"} · Tiempos ${e.rating_timing ?? "—"}` : "No asistió"}
                      </span>
                    </p>
                    {e.highlights && <p className="mt-1 text-white/60">✅ {e.highlights}</p>}
                    {e.improvements && <p className="mt-1 text-white/60">🔧 {e.improvements}</p>}
                    {e.incidents && <p className="mt-1 text-red-300">⚠️ {e.incidents}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <AvailabilityPanel
        eventId={event.id}
        minConfirmations={event.min_confirmations}
        confirmedCount={confirmation?.confirmed_count ?? 0}
        maybeCount={confirmation?.maybe_count ?? 0}
        declinedCount={confirmation?.declined_count ?? 0}
        meetsMinimum={confirmation?.meets_minimum ?? false}
        team={team}
        responses={Object.fromEntries(responses)}
        currentMemberId={member.id}
      />

      {isStaff(member.role) && (
        <EventRegistrationsPanel
          eventId={event.id}
          stats={registrations}
          internalNotes={event.internal_notes ?? null}
        />
      )}

      {isStaff(member.role) && (
        <EventStatusControls
          eventId={event.id}
          status={event.status}
          isPublic={event.is_public}
          eventlyUrl={event.evently_url}
          meetsMinimum={confirmation?.meets_minimum ?? false}
        />
      )}
    </div>
  );
}
