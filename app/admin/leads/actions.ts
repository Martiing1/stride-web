"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const LEAD_STATUSES = ["nuevo", "contactado", "convertido", "descartado"] as const;

const NewLeadSchema = z.object({
  full_name: z.string().trim().min(2, "Falta el nombre").max(120),
  email: z.string().trim().email("Email inválido").max(160).or(z.literal("")),
  whatsapp: z.string().trim().max(30),
  motivation: z.enum(["social_run", "constancia", "membresia"]),
  status: z.enum(LEAD_STATUSES),
  notes: z.string().trim().max(1000),
});

export interface LeadActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Alta manual de un lead. Sirve para la gente que llega por WhatsApp, por
 * Instagram o de boca en boca, que hoy se perdía porque solo entraban los del
 * formulario de la web.
 */
export async function createLead(formData: FormData): Promise<LeadActionResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = NewLeadSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    motivation: formData.get("motivation") ?? "social_run",
    status: formData.get("status") ?? "nuevo",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const d = parsed.data;

  // La tabla exige email y whatsapp; para un lead manual puede faltar uno.
  if (!d.email && !d.whatsapp) {
    return { ok: false, error: "Necesitamos al menos un email o un WhatsApp." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    full_name: d.full_name,
    email: d.email || "sin-email@stride.local",
    whatsapp: d.whatsapp || "",
    motivation: d.motivation,
    status: d.status,
    notes: d.notes || null,
    source: "manual",
  });

  if (error) return { ok: false, error: "No se pudo crear el lead." };

  revalidatePath("/admin/leads");
  return { ok: true };
}

const MoveSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(LEAD_STATUSES),
});

/** Mueve un lead de columna en el Kanban. */
export async function moveLead(formData: FormData): Promise<LeadActionResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = MoveSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: "No se pudo mover el lead." };

  revalidatePath("/admin/leads");
  revalidatePath("/admin");
  return { ok: true };
}

const NotesSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().trim().max(1000),
});

export async function updateLeadNotes(formData: FormData): Promise<LeadActionResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = NotesSchema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ notes: parsed.data.notes || null })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: "No se pudo guardar la nota." };

  revalidatePath("/admin/leads");
  return { ok: true };
}

export async function deleteLead(formData: FormData): Promise<LeadActionResult> {
  await requireTeamMember(["socio"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Lead inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", id.data);

  if (error) return { ok: false, error: "No se pudo eliminar." };

  revalidatePath("/admin/leads");
  return { ok: true };
}
