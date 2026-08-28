import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, CalendarDays } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PlanForm } from "@/components/admin/PlanForm";
import type { StrideEvent, EventPlan, Route, TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlanificacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: eventData } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!eventData) notFound();
  const event = eventData as StrideEvent;

  const [{ data: planData }, { data: routesData }, { data: teamData }] = await Promise.all([
    supabase.from("event_plans").select("*").eq("event_id", id).maybeSingle(),
    supabase.from("routes").select("*").eq("active", true).order("name"),
    supabase.from("team_members").select("*").eq("status", "activo").order("full_name"),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/planificaciones"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Planificaciones
        </Link>

        <h1 className="font-heading text-3xl font-extrabold text-white">{event.title}</h1>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/50">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-white/30" />
            {event.event_date.split("-").reverse().join("/")}
          </span>
          {event.meeting_point && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-white/30" />
              {event.meeting_point}
            </span>
          )}
          <Link href={`/admin/eventos/${event.id}`} className="text-stride-cyan hover:underline">
            Ver evento
          </Link>
        </div>
      </header>

      <PlanForm
        eventId={event.id}
        plan={(planData as EventPlan | null) ?? null}
        routes={(routesData ?? []) as Route[]}
        team={(teamData ?? []) as TeamMember[]}
      />
    </div>
  );
}
