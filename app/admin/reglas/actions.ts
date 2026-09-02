"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export interface RuleResult {
  ok: boolean;
  error?: string;
}

const RuleSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(3, "Título muy corto").max(160),
  statement: z.string().trim().min(10, "El texto de la regla es muy corto").max(4000),
  area: z.string().trim().max(80),
  // Quién la lee: todo el equipo o solo los socios.
  visibility: z.enum(["equipo", "socios", "area"]),
  reason: z.string().trim().max(500),
});

/**
 * Edita una regla vigente (solo socios). El texto anterior queda en el
 * historial como cambio "modificada", para que la regla nunca pierda su
 * trazabilidad.
 */
export async function updateRule(formData: FormData): Promise<RuleResult> {
  await requireTeamMember(["socio"]);
  const parsed = RuleSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    statement: formData.get("statement"),
    area: formData.get("area") ?? "",
    visibility: formData.get("visibility") ?? "equipo",
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  const service = createServiceClient();
  const { data: before } = await service.from("rules").select("statement, title, visibility, area").eq("id", d.id).maybeSingle();
  if (!before) return { ok: false, error: "La regla no existe." };

  const { error } = await service
    .from("rules")
    .update({
      title: d.title,
      statement: d.statement,
      area: d.area || null,
      visibility: d.visibility,
      updated_at: new Date().toISOString(),
    })
    .eq("id", d.id);
  if (error) return { ok: false, error: "No se pudo guardar la regla." };

  if (before.statement !== d.statement || before.title !== d.title) {
    await service.from("rule_changes").insert({
      rule_id: d.id,
      change_kind: "modificada",
      previous_statement: before.statement,
      reason: d.reason || "Edición directa desde el ERP",
      applied_at: new Date().toISOString(),
    });
  }

  revalidatePath("/admin/reglas");
  return { ok: true };
}
