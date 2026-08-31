"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember, getCurrentTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface BookResult {
  ok: boolean;
  error?: string;
}

/** Suma días hábiles (el pacto cuenta en hábiles, no corridos). */
function addBusinessDays(from: Date, days: number): string {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

const RegisterSchema = z.object({
  team_member_id: z.string().uuid("Elige a quién involucra"),
  subject: z.string().trim().min(5, "Describe el output u obligación afectada").max(300),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  evidence: z.string().trim().max(2000),
  task_id: z.string().uuid().or(z.literal("")),
  grave_directo: z.enum(["si", "no"]).default("no"),
});

/**
 * Registra un incumplimiento en el Libro (Pacto 10.1). Registrar NO significa
 * que esté acreditado: nace como acusación, se notifica, y el involucrado
 * tiene 5 días hábiles para descargos y subsanación.
 */
export async function registerIncumplimiento(formData: FormData): Promise<BookResult> {
  const member = await requireTeamMember(["socio"]);

  const parsed = RegisterSchema.safeParse({
    team_member_id: formData.get("team_member_id"),
    subject: formData.get("subject"),
    occurred_on: formData.get("occurred_on"),
    evidence: formData.get("evidence") ?? "",
    task_id: formData.get("task_id") ?? "",
    grave_directo: formData.get("grave_directo") ?? "no",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("incumplimientos").insert({
    team_member_id: d.team_member_id,
    subject: d.subject,
    occurred_on: d.occurred_on,
    evidence: d.evidence || null,
    task_id: d.task_id || null,
    // Un grave directo (10.6) no pasa por acumulación ni plan de mejora.
    classification: d.grave_directo === "si" ? "grave_directo" : "sin_calificar",
    registered_by: member.id,
  });
  if (error) return { ok: false, error: "No se pudo registrar. ¿Corriste la migración 011?" };

  revalidatePath("/admin/incumplimientos");
  return { ok: true };
}

/** Notifica por escrito y abre el plazo de 5 días hábiles (Pacto 10.1 y 10.2). */
export async function notifyIncumplimiento(formData: FormData): Promise<BookResult> {
  await requireTeamMember(["socio"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Registro inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("incumplimientos")
    .update({
      notified_at: new Date().toISOString(),
      remediation_due: addBusinessDays(new Date(), 5),
      status: "notificado",
    })
    .eq("id", id.data);
  if (error) return { ok: false, error: "No se pudo notificar." };

  revalidatePath("/admin/incumplimientos");
  return { ok: true };
}

const ResolveSchema = z.object({
  id: z.string().uuid(),
  classification: z.enum(["subsanado", "leve_efectivo", "grave_directo"]),
  remediation_result: z.string().trim().max(1500),
  measures: z.string().trim().max(1500),
});

/**
 * Califica la falta y cierra el procedimiento (Pacto 10.1.h/i). Subsanado
 * queda como antecedente y NO cuenta para la acumulación de los seis meses.
 */
export async function resolveIncumplimiento(formData: FormData): Promise<BookResult> {
  await requireTeamMember(["socio"]);

  const parsed = ResolveSchema.safeParse({
    id: formData.get("id"),
    classification: formData.get("classification"),
    remediation_result: formData.get("remediation_result") ?? "",
    measures: formData.get("measures") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("incumplimientos")
    .update({
      classification: parsed.data.classification,
      remediation_result: parsed.data.remediation_result || null,
      measures: parsed.data.measures || null,
      status: "cerrado",
    })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudo calificar." };

  revalidatePath("/admin/incumplimientos");
  return { ok: true };
}

export async function annulIncumplimiento(formData: FormData): Promise<BookResult> {
  await requireTeamMember(["socio"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Registro inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("incumplimientos").update({ status: "anulado" }).eq("id", id.data);
  if (error) return { ok: false, error: "No se pudo anular." };

  revalidatePath("/admin/incumplimientos");
  return { ok: true };
}

/** Descargos del involucrado (Pacto 10.1.f). El trigger blinda el resto. */
export async function submitDescargos(formData: FormData): Promise<BookResult> {
  const member = await getCurrentTeamMember();
  if (!member) return { ok: false, error: "Tu sesión venció." };

  const parsed = z
    .object({ id: z.string().uuid(), member_response: z.string().trim().min(3, "Escribe tus descargos").max(3000) })
    .safeParse({ id: formData.get("id"), member_response: formData.get("member_response") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("incumplimientos")
    .update({ member_response: parsed.data.member_response })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudieron guardar tus descargos." };

  revalidatePath("/admin/incumplimientos");
  return { ok: true };
}

const PlanSchema = z.object({
  team_member_id: z.string().uuid(),
  deficiencies: z.string().trim().min(5, "Describe qué debe corregirse").max(2000),
  outputs: z.string().trim().min(5, "Lista los outputs comprometidos").max(2000),
  acceptance_criteria: z.string().trim().max(1500),
  support: z.string().trim().max(1500),
});

/** Plan de Mejora de 30 días corridos (Pacto 10.4). */
export async function createImprovementPlan(formData: FormData): Promise<BookResult> {
  const member = await requireTeamMember(["socio"]);

  const parsed = PlanSchema.safeParse({
    team_member_id: formData.get("team_member_id"),
    deficiencies: formData.get("deficiencies"),
    outputs: formData.get("outputs"),
    acceptance_criteria: formData.get("acceptance_criteria") ?? "",
    support: formData.get("support") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 30);

  const supabase = await createClient();
  const { error } = await supabase.from("improvement_plans").insert({
    ...parsed.data,
    acceptance_criteria: parsed.data.acceptance_criteria || null,
    support: parsed.data.support || null,
    due_on: due.toISOString().slice(0, 10),
    created_by: member.id,
  });
  if (error) return { ok: false, error: "No se pudo crear el plan." };

  revalidatePath("/admin/incumplimientos");
  return { ok: true };
}

export async function closeImprovementPlan(formData: FormData): Promise<BookResult> {
  await requireTeamMember(["socio"]);

  const parsed = z
    .object({
      id: z.string().uuid(),
      result: z.enum(["cumplido", "incumplido"]),
      closing_notes: z.string().trim().max(1500),
    })
    .safeParse({
      id: formData.get("id"),
      result: formData.get("result"),
      closing_notes: formData.get("closing_notes") ?? "",
    });
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("improvement_plans")
    .update({ result: parsed.data.result, closing_notes: parsed.data.closing_notes || null })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudo cerrar el plan." };

  revalidatePath("/admin/incumplimientos");
  return { ok: true };
}
