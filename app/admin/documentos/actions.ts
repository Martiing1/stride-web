"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DriveFile } from "@/lib/google-drive";

export interface DocResult {
  ok: boolean;
  error?: string;
}

const FolderIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,80}$/);

/** Sesiones de subida por llamada: el cliente parte los lotes grandes. */
const MAX_FILES_PER_CALL = 50;

const UploadFilesSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(255),
      type: z.string().max(255),
      size: z.number().int().positive(),
    })
  )
  .min(1)
  .max(MAX_FILES_PER_CALL);

export interface UploadSessionsResult {
  ok: boolean;
  error?: string;
  /** Una URL de subida por archivo, en el mismo orden en que se pidieron. */
  urls?: string[];
}

/**
 * Prepara la subida masiva de archivos a una carpeta del Drive de STRIDE.
 *
 * Solo abre las sesiones de subida (una por archivo); los bytes los manda el
 * navegador directo a Google, así que no hay tope de peso por archivo. Se
 * valida que la carpeta destino cuelgue del árbol TEAM STRIDE: este módulo
 * jamás toca nada fuera de esa carpeta.
 */
export async function startDocumentUploads(
  folderId: string,
  files: Array<{ name: string; type: string; size: number }>
): Promise<UploadSessionsResult> {
  await requireTeamMember();

  const folder = FolderIdSchema.safeParse(folderId);
  const list = UploadFilesSchema.safeParse(files);
  if (!folder.success) return { ok: false, error: "Carpeta inválida" };
  if (!list.success) return { ok: false, error: "Archivos inválidos" };

  const { breadcrumb, startResumableUpload, driveConfigured } = await import("@/lib/google-drive");
  if (!driveConfigured()) return { ok: false, error: "Drive no está configurado en este entorno." };

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  try {
    const trail = await breadcrumb(folder.data);
    if (trail === null) return { ok: false, error: "Esa carpeta no pertenece a TEAM STRIDE." };

    // De a 10 en paralelo: rápido sin rozar los límites de Google.
    const urls: string[] = [];
    for (let i = 0; i < list.data.length; i += 10) {
      const chunk = list.data.slice(i, i + 10);
      urls.push(
        ...(await Promise.all(
          chunk.map((f) => startResumableUpload(folder.data, f.name, f.type || "application/octet-stream", f.size, origin))
        ))
      );
    }
    return { ok: true, urls };
  } catch {
    return { ok: false, error: "Drive no respondió. Intenta de nuevo." };
  }
}

export interface EventFolderResult {
  ok: boolean;
  error?: string;
  folder?: { id: string; name: string; url: string };
  files?: DriveFile[];
}

/**
 * Carpeta de Drive de un evento, creada la primera vez que alguien la abre
 * (el popup de evaluación post social run la pide al aparecer).
 */
export async function openEventFolder(eventId: string): Promise<EventFolderResult> {
  await requireTeamMember();

  const id = z.string().uuid().safeParse(eventId);
  if (!id.success) return { ok: false, error: "Evento inválido" };

  const { driveConfigured, ensureEventFolder, listFolder } = await import("@/lib/google-drive");
  if (!driveConfigured()) return { ok: false, error: "Drive no está configurado en este entorno." };

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, title, event_date").eq("id", id.data).maybeSingle();
  if (!event) return { ok: false, error: "Evento no encontrado." };

  try {
    const folder = await ensureEventFolder(event);
    const files = (await listFolder(folder.id)).filter((f) => !f.isFolder);
    return { ok: true, folder: { id: folder.id, name: folder.name, url: folder.webViewLink }, files };
  } catch {
    return { ok: false, error: "No pudimos hablar con Google Drive." };
  }
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
