"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";

export interface DocResult {
  ok: boolean;
  error?: string;
}

const FolderIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,80}$/);

/**
 * Sube un archivo del equipo a una carpeta del Drive de STRIDE.
 * Se valida que la carpeta destino cuelgue del árbol TEAM STRIDE: este módulo
 * jamás toca nada fuera de esa carpeta.
 */
export async function uploadDocument(formData: FormData): Promise<DocResult> {
  await requireTeamMember();

  const folder = FolderIdSchema.safeParse(formData.get("folder_id"));
  if (!folder.success) return { ok: false, error: "Carpeta inválida" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecciona un archivo." };
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, error: "Máximo 4 MB por archivo desde el ERP. Para más pesado, súbelo directo a Drive." };
  }

  const { breadcrumb, uploadFile, driveConfigured } = await import("@/lib/google-drive");
  if (!driveConfigured()) return { ok: false, error: "Drive no está configurado en este entorno." };

  try {
    const trail = await breadcrumb(folder.data);
    if (trail === null) return { ok: false, error: "Esa carpeta no pertenece a TEAM STRIDE." };
    await uploadFile(folder.data, file.name, file.type || "application/octet-stream", new Uint8Array(await file.arrayBuffer()));
  } catch {
    return { ok: false, error: "Drive rechazó la subida. Intenta de nuevo." };
  }

  revalidatePath("/admin/documentos");
  return { ok: true };
}

/** Crea una subcarpeta dentro del árbol TEAM STRIDE. */
export async function createDriveFolder(formData: FormData): Promise<DocResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parent = FolderIdSchema.safeParse(formData.get("parent_id"));
  const name = z.string().trim().min(1).max(120).safeParse(formData.get("name"));
  if (!parent.success || !name.success) return { ok: false, error: "Datos inválidos" };

  const { breadcrumb, createFolder, driveConfigured } = await import("@/lib/google-drive");
  if (!driveConfigured()) return { ok: false, error: "Drive no está configurado en este entorno." };

  try {
    const trail = await breadcrumb(parent.data);
    if (trail === null) return { ok: false, error: "Esa carpeta no pertenece a TEAM STRIDE." };
    await createFolder(parent.data, name.data);
  } catch {
    return { ok: false, error: "No se pudo crear la carpeta." };
  }

  revalidatePath("/admin/documentos");
  return { ok: true };
}
