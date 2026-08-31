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

  // El Pacto (10.1) exige que el registro viva en el Libro del Drive: se
  // archiva solo al cerrar. Si Drive falla, el cierre igual queda hecho y
  // siempre se puede reexportar a mano.
  try {
    const form = new FormData();
    form.set("id", parsed.data.id);
    await exportIncumplimientoToDrive(form);
  } catch {
    /* el registro en la base es la fuente de verdad */
  }

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

const esc = (v: string | null | undefined) =>
  (v ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CLASS_LABEL: Record<string, string> = {
  sin_calificar: "Sin calificar",
  subsanado: "Subsanado (antecedente, no acumula)",
  leve_efectivo: "Incumplimiento Leve efectivo",
  grave_directo: "Incumplimiento Grave directo",
};

/**
 * Guarda el acta en Drive, en la carpeta "Libro de Actas y Gobernanza" que
 * exige el Pacto (10.1 y 18). Se llama sola al cerrar un registro y también
 * a mano; cada exportación crea una versión nueva y nunca pisa la anterior.
 */
export async function exportIncumplimientoToDrive(formData: FormData): Promise<BookResult & { url?: string }> {
  await requireTeamMember(["socio"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Registro inválido" };

  const { driveConfigured, ensureRootFolder, uploadAsGoogleDoc } = await import("@/lib/google-drive");
  if (!driveConfigured()) return { ok: false, error: "Drive no está configurado en este entorno." };

  const supabase = await createClient();
  const [{ data: row }, { data: team }] = await Promise.all([
    supabase.from("incumplimientos").select("*").eq("id", id.data).maybeSingle(),
    supabase.from("team_members").select("id, full_name, nickname, role"),
  ]);
  if (!row) return { ok: false, error: "No encontramos el registro." };

  const person = (uid: string | null) => {
    const p = (team ?? []).find((t) => t.id === uid);
    return p ? p.full_name : "—";
  };
  const fecha = (v: string | null) => (v ? v.slice(0, 10).split("-").reverse().join("/") : "—");

  // Los nueve campos mínimos del Pacto 10.1, en el mismo orden del texto.
  const html = `
<h1>STRIDE SpA — Libro de Incumplimientos</h1>
<p><i>Registro conforme al Capítulo 10 del Pacto de Socios y Gobernanza Societaria.</i></p>
<table border="1">
<tr><td><b>a) Involucrado</b></td><td>${esc(person(row.team_member_id))}</td></tr>
<tr><td><b>b) Output, obligación o conducta afectada</b></td><td>${esc(row.subject)}</td></tr>
<tr><td><b>c) Fecha del incumplimiento</b></td><td>${fecha(row.occurred_on)}</td></tr>
<tr><td><b>d) Antecedentes o medios de respaldo</b></td><td>${esc(row.evidence)}</td></tr>
<tr><td><b>e) Fecha de notificación</b></td><td>${fecha(row.notified_at)}</td></tr>
<tr><td><b>f) Descargos presentados</b></td><td>${esc(row.member_response)}</td></tr>
<tr><td><b>g) Plazo y resultado de la subsanación</b></td><td>Plazo hasta ${fecha(row.remediation_due)}. ${esc(row.remediation_result)}</td></tr>
<tr><td><b>h) Calificación final de la falta</b></td><td>${esc(CLASS_LABEL[row.classification] ?? row.classification)}</td></tr>
<tr><td><b>i) Medidas adoptadas</b></td><td>${esc(row.measures)}</td></tr>
</table>
<p><b>Registrado por:</b> ${esc(person(row.registered_by))} · <b>Estado:</b> ${esc(row.status)}</p>
<p style="font-size:10pt;color:#666">La sola incorporación de una acusación al Libro no significa que el
incumplimiento se encuentre acreditado (Pacto, 10.1). Documento generado desde el ERP STRIDE.</p>`;

  try {
    const folder = await ensureRootFolder("Libro de Actas y Gobernanza");
    const stamp = new Date()
      .toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false })
      .replace(/[/:]/g, "-")
      .replace(", ", " ");
    const doc = await uploadAsGoogleDoc(
      folder,
      `Incumplimiento — ${person(row.team_member_id)} — ${fecha(row.occurred_on)} (${stamp})`,
      html
    );
    await supabase.from("incumplimientos").update({ drive_url: doc.webViewLink }).eq("id", row.id);
    revalidatePath("/admin/incumplimientos");
    return { ok: true, url: doc.webViewLink };
  } catch {
    return { ok: false, error: "Drive rechazó el documento. Intenta de nuevo." };
  }
}

/** Guarda un Plan de Mejora en la misma carpeta de gobernanza (Pacto 10.4). */
export async function exportPlanToDrive(formData: FormData): Promise<BookResult & { url?: string }> {
  await requireTeamMember(["socio"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Plan inválido" };

  const { driveConfigured, ensureRootFolder, uploadAsGoogleDoc } = await import("@/lib/google-drive");
  if (!driveConfigured()) return { ok: false, error: "Drive no está configurado en este entorno." };

  const supabase = await createClient();
  const [{ data: plan }, { data: team }] = await Promise.all([
    supabase.from("improvement_plans").select("*").eq("id", id.data).maybeSingle(),
    supabase.from("team_members").select("id, full_name"),
  ]);
  if (!plan) return { ok: false, error: "No encontramos el plan." };

  const name = (team ?? []).find((t) => t.id === plan.team_member_id)?.full_name ?? "—";
  const fecha = (v: string) => v.slice(0, 10).split("-").reverse().join("/");
  const html = `
<h1>STRIDE SpA — Plan de Mejora</h1>
<p><i>Conforme al numeral 10.4 del Pacto de Socios. Duración: 30 días corridos.</i></p>
<table border="1">
<tr><td><b>Involucrado</b></td><td>${esc(name)}</td></tr>
<tr><td><b>Periodo</b></td><td>${fecha(plan.started_on)} al ${fecha(plan.due_on)}</td></tr>
<tr><td><b>a) Conductas o deficiencias a corregir</b></td><td>${esc(plan.deficiencies)}</td></tr>
<tr><td><b>b) y c) Outputs comprometidos y fechas</b></td><td>${esc(plan.outputs)}</td></tr>
<tr><td><b>d) Criterios objetivos de aceptación</b></td><td>${esc(plan.acceptance_criteria)}</td></tr>
<tr><td><b>e) Apoyo, redistribución o seguimiento</b></td><td>${esc(plan.support)}</td></tr>
<tr><td><b>Resultado</b></td><td>${esc(plan.result)}. ${esc(plan.closing_notes)}</td></tr>
</table>
<p style="font-size:10pt;color:#666">Documento generado desde el ERP STRIDE.</p>`;

  try {
    const folder = await ensureRootFolder("Libro de Actas y Gobernanza");
    const doc = await uploadAsGoogleDoc(folder, `Plan de Mejora — ${name} — ${fecha(plan.started_on)}`, html);
    revalidatePath("/admin/incumplimientos");
    return { ok: true, url: doc.webViewLink };
  } catch {
    return { ok: false, error: "Drive rechazó el documento." };
  }
}
