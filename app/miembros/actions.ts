"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/member-auth";

export interface MemberProfileResult { ok: boolean; error?: string }

export async function uploadMemberPhoto(formData: FormData): Promise<MemberProfileResult> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: "Tu sesión venció. Vuelve a ingresar." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecciona una foto." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "La foto debe pesar menos de 5 MB." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected) return { ok: false, error: "Usa una imagen JPEG, PNG o WebP válida." };

  const path = `${member.id}/${randomUUID()}.${detected.extension}`;
  const service = createServiceClient();
  const { error: uploadError } = await service.storage
    .from("member-photos")
    .upload(path, bytes, { contentType: detected.mime, upsert: false, cacheControl: "300" });
  if (uploadError) return { ok: false, error: "No pudimos guardar la foto." };

  const { error: updateError } = await service
    .from("members")
    .update({ photo_path: path })
    .eq("id", member.id)
    .eq("auth_user_id", member.auth_user_id);
  if (updateError) {
    await service.storage.from("member-photos").remove([path]);
    return { ok: false, error: "No pudimos actualizar el carnet." };
  }

  if (member.photo_path) await service.storage.from("member-photos").remove([member.photo_path]);
  revalidatePath("/miembros");
  return { ok: true };
}

export async function signOutMember() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/miembros/ingresar");
}

function detectImage(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return { mime: "image/png", extension: "png" };
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}
