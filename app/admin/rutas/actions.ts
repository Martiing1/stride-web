"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface RouteResult {
  ok: boolean;
  error?: string;
}

const RouteSchema = z.object({
  name: z.string().trim().min(3, "Ponle nombre a la ruta").max(150),
  distance_km: z.string().max(10),
  difficulty: z.enum(["facil", "media", "dificil"]).or(z.literal("")),
  start_point: z.string().trim().max(200),
  end_point: z.string().trim().max(200),
  external_url: z.string().trim().url("Link inválido").max(500).or(z.literal("")),
  traffic_lights: z.string().max(4),
  safety_notes: z.string().trim().max(1000),
  surface: z.string().trim().max(60),
  notes: z.string().trim().max(1000),
  // Distancias que se corren en la ruta (3K/5K son las habituales), separadas por coma.
  distances: z.string().max(60),
});

function toRow(d: z.infer<typeof RouteSchema>) {
  return {
    name: d.name,
    distance_km: d.distance_km ? Number(d.distance_km) : null,
    difficulty: d.difficulty || null,
    start_point: d.start_point || null,
    end_point: d.end_point || null,
    external_url: d.external_url || null,
    traffic_lights: d.traffic_lights ? Number(d.traffic_lights) : null,
    safety_notes: d.safety_notes || null,
    surface: d.surface || null,
    notes: d.notes || null,
    distances_km: d.distances
      .split(",")
      .map((v) => Number(v.trim().replace(",", ".")))
      .filter((n) => Number.isFinite(n) && n > 0),
  };
}

function parse(formData: FormData) {
  return RouteSchema.safeParse({
    name: formData.get("name"),
    distance_km: formData.get("distance_km") ?? "",
    difficulty: formData.get("difficulty") ?? "",
    start_point: formData.get("start_point") ?? "",
    end_point: formData.get("end_point") ?? "",
    external_url: formData.get("external_url") ?? "",
    traffic_lights: formData.get("traffic_lights") ?? "",
    safety_notes: formData.get("safety_notes") ?? "",
    surface: formData.get("surface") ?? "",
    notes: formData.get("notes") ?? "",
    distances: formData.getAll("distances").join(","),
  });
}

export async function createRoute(formData: FormData): Promise<RouteResult> {
  const member = await requireTeamMember(["socio", "lider_comunidad"]);
  const parsed = parse(formData);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("routes")
    .insert({ ...toRow(parsed.data), created_by: member.id });

  if (error) return { ok: false, error: "No se pudo crear la ruta." };

  revalidatePath("/admin/rutas");
  return { ok: true };
}

export async function updateRoute(formData: FormData): Promise<RouteResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Ruta inválida" };

  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("routes").update(toRow(parsed.data)).eq("id", id.data);

  if (error) return { ok: false, error: "No se pudo guardar." };

  revalidatePath("/admin/rutas");
  return { ok: true };
}

/**
 * Archiva en vez de borrar: una ruta puede estar referenciada por eventos
 * pasados, y borrarla dejaría esos eventos sin su trazado.
 */
export async function archiveRoute(formData: FormData): Promise<RouteResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!id.success) return { ok: false, error: "Ruta inválida" };

  const supabase = await createClient();
  const { error } = await supabase.from("routes").update({ active }).eq("id", id.data);

  if (error) return { ok: false, error: "No se pudo actualizar." };

  revalidatePath("/admin/rutas");
  return { ok: true };
}

const GpxSchema = z.object({
  id: z.string().uuid(),
  gpx_url: z.string().url().max(500),
});

/** Guarda la URL del GPX ya subido al bucket desde el cliente. */
export async function setRouteGpx(formData: FormData): Promise<RouteResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = GpxSchema.safeParse({
    id: formData.get("id"),
    gpx_url: formData.get("gpx_url"),
  });
  if (!parsed.success) return { ok: false, error: "Archivo inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("routes")
    .update({ gpx_url: parsed.data.gpx_url })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: "No se pudo asociar el archivo." };

  revalidatePath("/admin/rutas");
  return { ok: true };
}

const ImagesSchema = z.object({
  id: z.string().uuid(),
  image_urls: z.array(z.string().url().max(500)).max(12),
});

/** Reemplaza la lista de fotos de la ruta (las sube el navegador al bucket `rutas`). */
export async function setRouteImages(formData: FormData): Promise<RouteResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);
  let urls: unknown = [];
  try { urls = JSON.parse(String(formData.get("image_urls") ?? "[]")); } catch { /* vacío */ }
  const parsed = ImagesSchema.safeParse({ id: formData.get("id"), image_urls: urls });
  if (!parsed.success) return { ok: false, error: "Imágenes inválidas" };

  const supabase = await createClient();
  const { error } = await supabase.from("routes").update({ image_urls: parsed.data.image_urls }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudieron guardar las imágenes. ¿Corriste la migración 017?" };
  revalidatePath("/admin/rutas");
  return { ok: true };
}
