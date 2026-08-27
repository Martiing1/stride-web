import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Clock, Route, Ticket } from "lucide-react";
import { requireTeamMember, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityPanel } from "@/components/admin/AvailabilityPanel";
import { EventStatusControls } from "@/components/admin/EventStatusControls";
import type { StrideEvent, EventConfirmationStatus, TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";

interface AvailabilityRow {
  team_member_id: string;
  response: "si" | "no" | "tal_vez";
}

export default async function EventoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const member = await requireTeamMember();
  const { id } = await params;
  const supabase = await createClient();

  const { data: eventData } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!eventData) notFound();

  const event = eventData as StrideEvent;

  const [{ data: confData }, { data: teamData }, { data: availData }] = await Promise.all([
    supabase.from("event_confirmation_status").select("*").eq("event_id", id).maybeSingle(),
    supabase.from("team_members").select("*").eq("status", "activo").order("full_name"),
    supabase.from("event_availability").select("team_member_id, response").eq("event_id", id),
  ]);

  const confirmation = confData as EventConfirmationStatus | null;
  const team = (teamData ?? []) as TeamMember[];
  const responses = new Map(
    ((availData ?? []) as AvailabilityRow[]).map((r) => [r.team_member_id, r.response])
  );

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/eventos"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Eventos
        </Link>

        <h1 className="font-heading text-3xl font-extrabold text-white">{event.title}</h1>

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
        </div>
      </header>

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
        <EventStatusControls
          eventId={event.id}
          status={event.status}
          isPublic={event.is_public}
          hasEventlyUrl={Boolean(event.evently_url)}
          meetsMinimum={confirmation?.meets_minimum ?? false}
        />
      )}
    </div>
  );
}
