"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { createAuthApiClient, createClient, createServiceClient } from "@/lib/supabase/server";
import { generateMemberCode, generateCardToken } from "@/lib/codes";
import { todayInChile } from "@/lib/membership";
import { SITE } from "@/lib/site";
import { canSendOwnEmail, sendMemberAccessEmail } from "@/lib/resend";

const MemberSchema = z.object({
  full_name: z.string().trim().min(2, "Falta el nombre").max(120),
  email: z.string().trim().email("Email inválido").max(160),
  whatsapp: z.string().trim().max(30),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  status: z.enum(["activa", "inactiva", "pausada"]),
});

export interface MemberActionResult {
  ok: boolean;
  error?: string;
  cardUrl?: string;
}

/**
 * Alta interna. No envía correo: Martín revisa la ficha y luego invita.
 */
export async function createMember(formData: FormData): Promise<MemberActionResult> {
  const owner = await requireOwner();

  const parsed = MemberSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    whatsapp: formData.get("whatsapp") ?? "",
    valid_until: formData.get("valid_until") ?? "",
    status: formData.get("status") ?? "activa",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const d = parsed.data;
  const supabase = await createClient();
  const defaultValidity = endOfCurrentMonth();

  // member_code es corto y aleatorio: en el peor caso choca con uno existente,
  // así que se reintenta en vez de fallarle al usuario.
  for (let attempt = 0; attempt < 5; attempt++) {
    const memberCode = generateMemberCode();
    const { data: created, error } = await supabase
      .from("members")
      .insert({
        member_code: memberCode,
        card_token: generateCardToken(),
        full_name: d.full_name,
        email: d.email.toLowerCase(),
        whatsapp: d.whatsapp || null,
        valid_until: d.valid_until || defaultValidity,
        status: d.status,
        invitation_status: "pendiente",
      })
      .select("id, status, valid_until")
      .single();

    if (!error && created) {
      await supabase.from("membership_audit_log").insert({
        member_id: created.id,
        performed_by: owner.id,
        action: "created",
        new_status: created.status,
        new_valid_until: created.valid_until,
      });
      revalidatePath("/admin/miembros");
      return { ok: true };
    }

    // 23505 = unique_violation: si fue el código, se reintenta con otro.
    if (error.code !== "23505") {
      return { ok: false, error: "No se pudo crear el miembro." };
    }

    if (error.message.toLowerCase().includes("email")) {
      return { ok: false, error: "Ya existe un miembro con ese email." };
    }
  }

  return { ok: false, error: "No se pudo generar un código único. Intenta otra vez." };
}

const StatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["activa", "inactiva", "pausada"]),
});

export async function setMemberStatus(formData: FormData): Promise<MemberActionResult> {
  const owner = await requireOwner();

  const parsed = StatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("members")
    .select("status, valid_until")
    .eq("id", parsed.data.id)
    .single();

  if (!previous) return { ok: false, error: "Miembro no encontrado." };

  const { error } = await supabase
    .from("members")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: "No se pudo actualizar." };

  await supabase.from("membership_audit_log").insert({
    member_id: parsed.data.id,
    performed_by: owner.id,
    action: parsed.data.status === "pausada" ? "paused" : "reactivated",
    previous_status: previous.status,
    new_status: parsed.data.status,
    previous_valid_until: previous.valid_until,
    new_valid_until: previous.valid_until,
  });

  revalidatePath("/admin/miembros");
  return { ok: true };
}

/**
 * Rota el link privado de la tarjeta. Se usa si un miembro reenvió su link a
 * terceros o cree que se filtró: el anterior deja de funcionar al instante.
 */
export async function regenerateCardToken(formData: FormData): Promise<MemberActionResult> {
  await requireOwner();

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

export async function renewMember(formData: FormData): Promise<MemberActionResult> {
  await requireOwner();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Miembro inválido" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("renew_member_one_month", {
    target_member_id: id.data,
  });
  if (error) return { ok: false, error: "No se pudo renovar la membresía." };

  revalidatePath("/admin/miembros");
  revalidatePath("/miembros");
  return { ok: true };
}

async function findAuthUserByEmail(email: string) {
  const service = createServiceClient();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 100) break;
  }
  return null;
}

export async function sendMemberInvitation(formData: FormData): Promise<MemberActionResult> {
  const owner = await requireOwner();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Miembro inválido" };

  const service = createServiceClient();
  const { data: member } = await service
    .from("members")
    .select("id, full_name, email, auth_user_id")
    .eq("id", id.data)
    .single();
  if (!member?.email) return { ok: false, error: "El miembro necesita un email." };

  let authUserId = member.auth_user_id as string | null;
  if (!authUserId) {
    let authUser = await findAuthUserByEmail(member.email);
    if (!authUser) {
      const { data, error } = await service.auth.admin.createUser({
        email: member.email,
        email_confirm: true,
        user_metadata: { full_name: member.full_name, account_type: "member" },
      });
      if (error || !data.user) {
        await service
          .from("members")
          .update({ invitation_status: "error" })
          .eq("id", member.id);
        return { ok: false, error: "No se pudo preparar el acceso." };
      }
      authUser = data.user;
    }
    authUserId = authUser.id;
  }

  const redirectTo = `${SITE.url}/auth/callback?next=/miembros`;
  const sendFailed = async (reason: string) => {
    await service.from("members").update({ invitation_status: "error" }).eq("id", member.id);
    return { ok: false as const, error: reason };
  };

  if (canSendOwnEmail()) {
    // Con remitente propio se manda un enlace de `token_hash`, que abre en
    // cualquier dispositivo, y el código de respaldo en el mismo correo.
    const { data: link, error: linkError } = await service.auth.admin.generateLink({
      type: "magiclink",
      email: member.email,
      options: { redirectTo },
    });

    if (linkError || !link?.properties) {
      return sendFailed("No se pudo generar el acceso. Revisa que el correo del miembro sea válido.");
    }

    const url = new URL(`${SITE.url}/auth/callback`);
    url.searchParams.set("token_hash", link.properties.hashed_token);
    url.searchParams.set("type", "magiclink");
    url.searchParams.set("next", "/miembros");

    try {
      await sendMemberAccessEmail({
        to: member.email,
        fullName: member.full_name,
        link: url.toString(),
        code: link.properties.email_otp ?? null,
      });
    } catch (err) {
      console.error("Fallo al enviar el acceso del miembro:", err);
      return sendFailed("Generamos el acceso pero el correo no salió. Revisa la configuración de Resend.");
    }
  } else {
    // Sin remitente propio manda Supabase, con su tope de envíos por hora.
    const authApi = createAuthApiClient();
    const { error: otpError } = await authApi.auth.signInWithOtp({
      email: member.email,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
    });

    if (otpError) {
      const m = otpError.message.toLowerCase();
      if (m.includes("rate limit") || m.includes("too many")) {
        return sendFailed("Supabase ya envió el máximo de correos de esta hora. Configura Resend o espera un rato.");
      }
      return sendFailed(`No se pudo enviar el acceso: ${otpError.message}`);
    }
  }

  const now = new Date().toISOString();
  await service
    .from("members")
    .update({ auth_user_id: authUserId, invitation_status: "enviada", invited_at: now })
    .eq("id", member.id);
  await service.from("membership_audit_log").insert({
    member_id: member.id,
    performed_by: owner.id,
    action: "invitation_sent",
  });

  revalidatePath("/admin/miembros");
  return { ok: true };
}

function endOfCurrentMonth() {
  const [year, month] = todayInChile().split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}
