import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateCL } from "@/lib/membership";
import { EvaluationForm } from "@/components/admin/EvaluationForm";
import type { StrideEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Evaluar social run" };

export default async function EvaluateEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const member = await requireTeamMember();
  const { eventId } = await params;
  const supabase = await createClient();

  const [{ data: eventData }, { data: existing }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
    supabase
      .from("event_evaluations")
      .select("id")
      .eq("event_id", eventId)
      .eq("team_member_id", member.id)
      .maybeSingle(),
  ]);
  const event = eventData as StrideEvent | null;
  if (!event) notFound();

  return (
    <div className="space-y-8">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
          <Lock className="h-3.5 w-3.5" /> Evaluación post social run
        </p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">{event.title}</h1>
        <p className="mt-1 text-white/50">{formatDateCL(event.event_date)}{event.meeting_point ? ` · ${event.meeting_point}` : ""}</p>
        {!existing && (
          <p className="mt-4 max-w-2xl rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100">
            El sistema interno queda bloqueado para ti hasta que entregues esta evaluación.
            Son 2 minutos, y es lo que nos deja mejorar el siguiente social run.
          </p>
        )}
      </header>

      <EvaluationForm eventId={event.id} />
    </div>
  );
}
