import { cache } from "react";
import { createClient, createServiceClient } from "./supabase/server";
import type { Member } from "./types";

/** Resuelve el miembro de la sesión OTP sin exponer la tabla al navegador. */
export const getCurrentMember = cache(async (): Promise<Member | null> => {
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user?.email) return null;

  const service = createServiceClient();
  let { data } = await service
    .from("members")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // El vínculo ya existía (lo dejó la invitación del ERP), así que la rama de
  // asociación de más abajo no corre. Sin esto la ficha se queda en "enviada"
  // para siempre y el panel nunca muestra quién entró de verdad.
  if (data) {
    const member = data as Member;
    const staleLogin =
      !member.last_login_at ||
      Date.now() - new Date(member.last_login_at).getTime() > 60 * 60 * 1000;

    if (member.invitation_status !== "activada" || staleLogin) {
      const now = new Date().toISOString();
      const { data: refreshed } = await service
        .from("members")
        .update({
          invitation_status: "activada",
          activated_at: member.activated_at ?? now,
          last_login_at: now,
        })
        .eq("id", member.id)
        .select("*")
        .single();
      if (refreshed) data = refreshed;
    }
  }

  // Asociación inicial segura: el email ya fue verificado mediante OTP y el
  // admin debió enviar antes la invitación.
  if (!data) {
    const { data: invited } = await service
      .from("members")
      .select("*")
      .ilike("email", user.email)
      .in("invitation_status", ["enviada", "activada"])
      .maybeSingle();

    if (!invited || (invited.auth_user_id && invited.auth_user_id !== user.id)) return null;

    const now = new Date().toISOString();
    const { data: linked } = await service
      .from("members")
      .update({
        auth_user_id: user.id,
        invitation_status: "activada",
        activated_at: invited.activated_at ?? now,
        last_login_at: now,
      })
      .eq("id", invited.id)
      .select("*")
      .single();
    data = linked;
  }

  return (data as Member | null) ?? null;
});

/**
 * Solo los socios administran el área de miembros (publicar como STRIDE,
 * fijar posts y editar el classroom). Líderes y monitores no reciben estos
 * privilegios aunque tengan una cuenta activa en el ERP.
 */
export const getCommunityStaff = cache(async () => {
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data } = await service
    .from("team_members")
    .select("id, full_name, nickname, role")
    .eq("auth_user_id", user.id)
    .eq("status", "activo")
    .eq("role", "socio")
    .maybeSingle();
  return (data as { id: string; full_name: string; nickname: string | null; role: string } | null) ?? null;
});

export async function getSignedMemberPhoto(member: Pick<Member, "photo_path" | "photo_url">) {
  if (member.photo_path) {
    const service = createServiceClient();
    const { data } = await service.storage
      .from("member-photos")
      .createSignedUrl(member.photo_path, 300);
    return data?.signedUrl ?? null;
  }
  return member.photo_url;
}
