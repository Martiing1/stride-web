"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateMemberCode, generateCardToken } from "@/lib/codes";

const MemberSchema = z.object({
  full_name: z.string().trim().min(2, "Falta el nombre").max(120),
  email: z.string().trim().email("Email inválido").max(160).or(z.literal("")),
  whatsapp: z.string().trim().max(30),
  photo_url: z.string().trim().url("URL de foto inválida").max(500).or(z.literal("")),
  skool_handle: z.string().trim().max(80),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  status: z.enum(["activa", "inactiva", "pausada"]),
});

export interface MemberActionResult {
  ok: boolean;
  error?: string;
  cardUrl?: string;
}

/**
 * Alta de un miembro. Se ejecuta cuando Martín o Juanjo confirman en Skool que
 * la persona pagó: el sistema le genera su código público y el token privado de
 * su tarjeta virtual.
 */
export async function createMember(formData: FormData): Promise<MemberActionResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = MemberSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    photo_url: formData.get("photo_url") ?? "",
    skool_handle: formData.get("skool_handle") ?? "",
    valid_until: formData.get("valid_until") ?? "",
    status: formData.get("status") ?? "activa",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const d = parsed.data;
  const supabase = await createClient();

  // member_code es corto y aleatorio: en el peor caso choca con uno existente,
  // así que se reintenta en vez de fallarle al usuario.
  for (let attempt = 0; attempt < 5; attempt++) {
    const memberCode = generateMemberCode();
    const { error } = await supabase.from("members").insert({
      member_code: memberCode,
      card_token: generateCardToken(),
      full_name: d.full_name,
      email: d.email || null,
      whatsapp: d.whatsapp || null,
      photo_url: d.photo_url || null,
      skool_handle: d.skool_handle || null,
      valid_until: d.valid_until || null,
      status: d.status,
    });

    if (!error) {
      revalidatePath("/admin/miembros");
      return { ok: true };
    }

    // 23505 = unique_violation: si fue el código, se reintenta con otro.
    if (error.code !== "23505") {
      return { ok: false, error: "No se pudo crear el miembro." };
    }
  }

  return { ok: false, error: "No se pudo generar un código único. Intenta otra vez." };
}

const StatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["activa", "inactiva", "pausada"]),
});

export async function setMemberStatus(formData: FormData): Promise<MemberActionResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = StatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: "No se pudo actualizar." };

  revalidatePath("/admin/miembros");
  return { ok: true };
}

/**
 * Rota el link privado de la tarjeta. Se usa si un miembro reenvió su link a
 * terceros o cree que se filtró: el anterior deja de funcionar al instante.
 */
export async function regenerateCardToken(formData: FormData): Promise<MemberActionResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Miembro inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({ card_token: generateCardToken() })
    .eq("id", id.data);

  if (error) return { ok: false, error: "No se pudo regenerar el link." };

  revalidatePath("/admin/miembros");
  return { ok: true };
}
