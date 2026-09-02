"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const rating = z.coerce.number().int().min(1).max(5).optional();

const EvaluationSchema = z.object({
  event_id: z.string().uuid(),
  attended: z.enum(["si", "no"]),
  rating_overall: rating,
  rating_team: rating,
  rating_safety: rating,
  rating_timing: rating,
  highlights: z.string().trim().max(2000),
  improvements: z.string().trim().max(2000),
  incidents: z.string().trim().max(2000),
});

export interface EvaluationResult {
  ok: boolean;
  error?: string;
}

/** Guarda (o corrige) la evaluación propia de un social run. */
export async function saveEvaluation(formData: FormData): Promise<EvaluationResult> {
  const member = await requireTeamMember();

  const parsed = EvaluationSchema.safeParse({
    event_id: formData.get("event_id"),
    attended: formData.get("attended") ?? "si",
    rating_overall: formData.get("rating_overall") || undefined,
    rating_team: formData.get("rating_team") || undefined,
    rating_safety: formData.get("rating_safety") || undefined,
    rating_timing: formData.get("rating_timing") || undefined,
    highlights: formData.get("highlights") ?? "",
    improvements: formData.get("improvements") ?? "",
    incidents: formData.get("incidents") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Revisa los campos del formulario." };

  const d = parsed.data;
  const attended = d.attended === "si";
  if (attended && !d.rating_overall) {
    return { ok: false, error: "Ponle una nota general al evento (1 a 5)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("event_evaluations").upsert(
    {
      event_id: d.event_id,
      team_member_id: member.id,
      attended,
      rating_overall: attended ? d.rating_overall ?? null : null,
      rating_team: attended ? d.rating_team ?? null : null,
      rating_safety: attended ? d.rating_safety ?? null : null,
      rating_timing: attended ? d.rating_timing ?? null : null,
      highlights: d.highlights || null,
      improvements: d.improvements || null,
      incidents: d.incidents || null,
    },
    { onConflict: "event_id,team_member_id" }
  );
  if (error) return { ok: false, error: "No se pudo guardar la evaluación." };

  // El popup del layout se cierra solo al refrescar: ya no hay página de evaluaciones.
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/metricas");
  return { ok: true };
}
