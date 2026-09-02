"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember, getCurrentTeamMember } from "@/lib/auth";
import { createAuthApiClient, createClient, createServiceClient } from "@/lib/supabase/server";
import { SITE } from "@/lib/site";

export interface TeamResult {
  ok: boolean;
  error?: string;
}

const PersonSchema = z.object({
  full_name: z.string().trim().min(3, "Nombre muy corto").max(120),
  nickname: z.string().trim().max(60),
  email: z.string().trim().email("Email inválido").max(160),
  role: z.enum(["socio", "lider_comunidad", "monitor"]),
  area: z.string().trim().max(120),
  status: z.enum(["activo", "inactivo"]),
});

function parse(formData: FormData) {
  return PersonSchema.safeParse({
    full_name: formData.get("full_name"),
    nickname: formData.get("nickname") ?? "",
    email: formData.get("email"),
    role: formData.get("role"),
    area: formData.get("area") ?? "",
    status: formData.get("status") ?? "activo",
  });
}

/** Columnas extra configurables: llegan como extra.<clave>=valor. */
function extraFrom(formData: FormData): Record<string, string> {
  const extra: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("extra.") && typeof v === "string") {
      const key = k.slice(6).trim();
      if (/^[a-z0-9_]{1,30}$/.test(key)) extra[key] = v.trim().slice(0, 200);
    }
  }
  return extra;
}

function toRow(d: z.infer<typeof PersonSchema>, extra?: Record<string, string>) {
  return {
    full_name: d.full_name,
    nickname: d.nickname || null,
    email: d.email.toLowerCase(),
    role: d.role,
    area: d.area || null,
    status: d.status,
    ...(extra ? { extra } : {}),
  };
}

export async function createTeamMember(formData: FormData): Promise<TeamResult> {
  await requireTeamMember(["socio"]);
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("team_members").insert(toRow(parsed.data, extraFrom(formData)));
  if (error) return { ok: false, error: "No se pudo crear. ¿El email ya existe?" };

  revalidatePath("/admin/configuracion");
  return { ok: true };
}

export async function updateTeamMember(formData: FormData): Promise<TeamResult> {
  const me = await requireTeamMember(["socio"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Persona inválida" };

  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  // Nadie se degrada ni desactiva a sí mismo: evita quedarse fuera del sistema.
  if (id.data === me.id && (parsed.data.role !== "socio" || parsed.data.status !== "activo")) {
    return { ok: false, error: "No puedes quitarte el rol de socio ni desactivarte a ti mismo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("team_members").update(toRow(parsed.data, extraFrom(formData))).eq("id", id.data);
  if (error) return { ok: false, error: "No se pudo guardar. ¿El email ya existe?" };

  revalidatePath("/admin/configuracion");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/**
 * Eliminar de verdad solo se permite si la persona nunca tuvo cuenta: para el
 * resto se usa "inactivo", que conserva su historial de tareas y actas.
 */
export async function deleteTeamMember(formData: FormData): Promise<TeamResult> {
  const me = await requireTeamMember(["socio"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Persona inválida" };
  if (id.data === me.id) return { ok: false, error: "No puedes eliminarte a ti mismo." };

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("team_members")
    .select("auth_user_id")
    .eq("id", id.data)
    .single();
  if (person?.auth_user_id) {
    return { ok: false, error: "Ya tiene cuenta y su historial importa: márcala como inactiva." };
  }

  const { error } = await supabase.from("team_members").delete().eq("id", id.data);
  if (error) return { ok: false, error: "No se pudo eliminar: tiene historial asociado. Márcala como inactiva." };

  revalidatePath("/admin/configuracion");
  return { ok: true };
}

async function findAuthUserByEmail(email: string) {
  const service = createServiceClient();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return null;

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) break;
  }
  return null;
}

/**
 * Crea o vincula la cuenta de Auth de una persona del equipo y le manda el
 * enlace para definir su contraseña. La autorización sigue viviendo en
 * team_members: tener una cuenta de Auth o ser miembro no habilita el ERP.
 */
export async function sendTeamInvitation(formData: FormData): Promise<TeamResult> {
  await requireTeamMember(["socio"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Persona inválida" };

  const service = createServiceClient();
  const { data: person } = await service
    .from("team_members")
    .select("id, full_name, email, status")
    .eq("id", id.data)
    .single();

  if (!person) return { ok: false, error: "Persona no encontrada." };
  if (person.status !== "activo") return { ok: false, error: "Activa a la persona antes de darle acceso." };

  const redirectTo = `${SITE.url}/admin/activar`;
  let authUser = await findAuthUserByEmail(person.email);

  if (!authUser) {
    // Supabase crea la cuenta y manda un enlace de invitación de un solo uso.
    // Al abrirlo, /admin/activar permite definir la contraseña inicial.
    const { data, error } = await service.auth.admin.inviteUserByEmail(person.email, {
      redirectTo,
      data: { full_name: person.full_name, account_type: "team" },
    });
    if (error || !data.user) {
      return { ok: false, error: "No se pudo enviar la invitación. Revisa el correo e inténtalo otra vez." };
    }
    authUser = data.user;
  } else {
    // Una cuenta puede pertenecer a members y team_members a la vez. En ese
    // caso no se duplica: se vincula la misma cuenta y se envía recuperación
    // para que pueda definir (o renovar) su contraseña del ERP.
    const authApi = createAuthApiClient();
    const { error } = await authApi.auth.resetPasswordForEmail(person.email, { redirectTo });
    if (error) {
      return { ok: false, error: "No se pudo reenviar el acceso. Inténtalo nuevamente." };
    }
  }

  const { error: linkError } = await service
    .from("team_members")
    .update({ auth_user_id: authUser.id })
    .eq("id", person.id);
  if (linkError) return { ok: false, error: "Se envió el correo, pero no pudimos enlazar la cuenta. Intenta nuevamente." };

  revalidatePath("/admin/configuracion");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

function detectImage(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47].every((v, i) => bytes[i] === v)) return { mime: "image/png", extension: "png" };
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}

/**
 * Foto de perfil. Cada persona puede subir la suya; un socio, la de cualquiera.
 */
export async function uploadTeamPhoto(formData: FormData): Promise<TeamResult> {
  const me = await getCurrentTeamMember();
  if (!me) return { ok: false, error: "Tu sesión venció." };

  const targetId = String(formData.get("id") ?? me.id);
  if (targetId !== me.id && me.role !== "socio") {
    return { ok: false, error: "Solo un socio cambia fotos ajenas." };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecciona una foto." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "La foto debe pesar menos de 5 MB." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected) return { ok: false, error: "Usa una imagen JPEG, PNG o WebP." };

  const service = createServiceClient();
  const { data: target } = await service
    .from("team_members")
    .select("photo_path")
    .eq("id", targetId)
    .single();
  if (!target) return { ok: false, error: "Persona no encontrada." };

  const path = `${targetId}/${randomUUID()}.${detected.extension}`;
  const { error: uploadError } = await service.storage
    .from("team-photos")
    .upload(path, bytes, { contentType: detected.mime, cacheControl: "600" });
  if (uploadError) return { ok: false, error: "No se pudo subir. ¿Corriste la migración 005?" };

  const { error: updateError } = await service
    .from("team_members")
    .update({ photo_path: path })
    .eq("id", targetId);
  if (updateError) {
    await service.storage.from("team-photos").remove([path]);
    return { ok: false, error: "No se pudo guardar la foto." };
  }
  if (target.photo_path) await service.storage.from("team-photos").remove([target.photo_path]);

  revalidatePath("/admin/configuracion");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
