import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, CalendarDays } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PlanForm } from "@/components/admin/PlanForm";
import { PlanStructureEditor } from "@/components/admin/PlanStructureEditor";
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

  // Estructura de la plantilla (itinerario, grupos, checklist). Si la
  // migración 004 no corrió aún, las consultas fallan y el editor parte vacío.
  const planId = (planData as EventPlan | null)?.id ?? null;
  const [blocksRes, groupsRes, checklistRes] = planId
    ? await Promise.all([
        supabase.from("plan_blocks").select("*").eq("plan_id", planId).order("sort_order"),
        supabase.from("plan_pace_groups").select("*").eq("plan_id", planId).order("sort_order"),
        supabase.from("plan_checklist_items").select("*").eq("plan_id", planId).order("sort_order"),
      ])
    : [{ data: null }, { data: null }, { data: null }];

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

      <PlanStructureEditor
        eventId={event.id}
        meetingTime={(planData as EventPlan | null)?.meeting_time ?? event.event_time}
        initialBlocks={(blocksRes.data ?? []).map((b: any) => ({
          section: b.section,
          block_time: b.block_time?.slice(0, 5) ?? "",
          leader_label: b.leader_label ?? "",
          activity: b.activity,
          notes: b.notes ?? "",
        }))}
        initialGroups={(groupsRes.data ?? []).map((g: any) => ({
          name: g.name,
          distance_km: Number(g.distance_km),
          pace_sec_per_km: g.pace_sec_per_km,
          break_min: g.break_min,
          leaders: g.leaders ?? "",
        }))}
        initialChecklist={(checklistRes.data ?? []).map((c: any) => ({ label: c.label, done: c.done }))}
      />
    </div>
  );
}
