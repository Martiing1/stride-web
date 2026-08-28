"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface PlanResult {
  ok: boolean;
  error?: string;
}

const uuidOrEmpty = z.string().uuid().or(z.literal(""));

const PlanSchema = z.object({
  event_id: z.string().uuid(),
  route_id: uuidOrEmpty,
  meeting_time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")),
  warmup_notes: z.string().trim().max(1000),
  icebreaker: z.string().trim().max(1000),
  groups_notes: z.string().trim().max(1000),
  post_run_notes: z.string().trim().max(1000),
  lead_id: uuidOrEmpty,
  sweeper_id: uuidOrEmpty,
  photographer_id: uuidOrEmpty,
  materials: z.string().trim().max(1000),
  sponsor_notes: z.string().trim().max(1000),
  contingency: z.string().trim().max(1000),
  status: z.enum(["borrador", "lista", "ejecutada"]),
});

/**
 * Guarda la planificación de un evento.
 *
 * Es un upsert sobre event_id (único): Fer y Nico entran, editan y guardan
 * cuantas veces quieran sin crear duplicados.
 */
export async function savePlan(formData: FormData): Promise<PlanResult> {
  const member = await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = PlanSchema.safeParse({
    event_id: formData.get("event_id"),
    route_id: formData.get("route_id") ?? "",
    meeting_time: formData.get("meeting_time") ?? "",
    warmup_notes: formData.get("warmup_notes") ?? "",
    icebreaker: formData.get("icebreaker") ?? "",
    groups_notes: formData.get("groups_notes") ?? "",
    post_run_notes: formData.get("post_run_notes") ?? "",
    lead_id: formData.get("lead_id") ?? "",
    sweeper_id: formData.get("sweeper_id") ?? "",
    photographer_id: formData.get("photographer_id") ?? "",
    materials: formData.get("materials") ?? "",
    sponsor_notes: formData.get("sponsor_notes") ?? "",
    contingency: formData.get("contingency") ?? "",
    status: formData.get("status") ?? "borrador",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const d = parsed.data;
  const nullIfEmpty = (v: string) => v || null;

  const supabase = await createClient();
  const { error } = await supabase.from("event_plans").upsert(
    {
      event_id: d.event_id,
      route_id: nullIfEmpty(d.route_id),
      meeting_time: nullIfEmpty(d.meeting_time),
      warmup_notes: nullIfEmpty(d.warmup_notes),
      icebreaker: nullIfEmpty(d.icebreaker),
      groups_notes: nullIfEmpty(d.groups_notes),
      post_run_notes: nullIfEmpty(d.post_run_notes),
      lead_id: nullIfEmpty(d.lead_id),
      sweeper_id: nullIfEmpty(d.sweeper_id),
      photographer_id: nullIfEmpty(d.photographer_id),
      materials: nullIfEmpty(d.materials),
      sponsor_notes: nullIfEmpty(d.sponsor_notes),
      contingency: nullIfEmpty(d.contingency),
      status: d.status,
      created_by: member.id,
    },
    { onConflict: "event_id" }
  );

  if (error) return { ok: false, error: "No se pudo guardar la planificación." };

  // La ruta elegida se refleja también en el evento, para que aparezca sin
  // tener que abrir la planificación.
  if (d.route_id) {
    await supabase.from("events").update({ route_id: d.route_id }).eq("id", d.event_id);
  }

  revalidatePath("/admin/planificaciones");
  revalidatePath(`/admin/planificaciones/${d.event_id}`);
  revalidatePath("/admin/eventos");
  return { ok: true };
}
