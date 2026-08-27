"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const EventSchema = z.object({
  title: z.string().trim().min(3, "Ponle un nombre al evento").max(200),
  event_type: z.enum([
    "social_run",
    "social_run_cafeteria",
    "social_run_sunset",
    "marca",
    "retiro",
    "race_trip",
    "otro",
  ]),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  event_time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")),
  meeting_point: z.string().trim().max(200),
  meeting_point_map_url: z.string().trim().url("Link de mapa inválido").max(500).or(z.literal("")),
  distance_km: z.string().max(10),
  evently_url: z.string().trim().url("Link de Evently inválido").max(500).or(z.literal("")),
  min_confirmations: z.string().max(3),
  spots_left: z.string().max(5),
});

export async function createEvent(formData: FormData) {
  const member = await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = EventSchema.safeParse({
    title: formData.get("title"),
    event_type: formData.get("event_type") ?? "social_run",
    event_date: formData.get("event_date"),
    event_time: formData.get("event_time") ?? "",
    meeting_point: formData.get("meeting_point") ?? "",
    meeting_point_map_url: formData.get("meeting_point_map_url") ?? "",
    distance_km: formData.get("distance_km") ?? "",
    evently_url: formData.get("evently_url") ?? "",
    min_confirmations: formData.get("min_confirmations") ?? "3",
    spots_left: formData.get("spots_left") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("events").insert({
    title: d.title,
    event_type: d.event_type,
    event_date: d.event_date,
    event_time: d.event_time || null,
    meeting_point: d.meeting_point || null,
    meeting_point_map_url: d.meeting_point_map_url || null,
    distance_km: d.distance_km ? Number(d.distance_km) : null,
    evently_url: d.evently_url || null,
    // Vacío = sin tope. La landing solo muestra el aviso de escasez cuando hay
    // un número real cargado.
    spots_left: d.spots_left === "" ? null : Number(d.spots_left),
    min_confirmations: Number(d.min_confirmations) || 3,
    owner_id: member.id,
    status: "planificacion",
  });

  if (error) return { ok: false, error: "No se pudo crear el evento." };

  revalidatePath("/admin/eventos");
  return { ok: true };
}

const StatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["planificacion", "encuesta_abierta", "confirmado", "cancelado", "completado"]),
  is_public: z.string().optional(),
});

/**
 * Cambia el estado del evento en el flujo de decisión.
 *
 * Publicar en la web exige que el evento esté confirmado y tenga link de
 * Evently: no tiene sentido mostrar en /eventos algo a lo que nadie se puede
 * inscribir.
 */
export async function setEventStatus(formData: FormData) {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = StatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    is_public: formData.get("is_public") ?? undefined,
  });

  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const makePublic = parsed.data.is_public === "true";

  if (makePublic) {
    const { data: event } = await supabase
      .from("events")
      .select("evently_url")
      .eq("id", parsed.data.id)
      .single();

    if (!event?.evently_url) {
      return {
        ok: false,
        error: "Para publicarlo en la web necesita su link de Evently.",
      };
    }
  }

  const { error } = await supabase
    .from("events")
    .update({
      status: parsed.data.status,
      ...(parsed.data.is_public !== undefined ? { is_public: makePublic } : {}),
    })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: "No se pudo actualizar el evento." };

  revalidatePath("/admin/eventos");
  revalidatePath(`/admin/eventos/${parsed.data.id}`);
  revalidatePath("/eventos");
  revalidatePath("/");
  return { ok: true };
}

const AvailabilitySchema = z.object({
  event_id: z.string().uuid(),
  response: z.enum(["si", "no", "tal_vez"]),
});

/** Respuesta del propio usuario a la encuesta de disponibilidad. */
export async function respondAvailability(formData: FormData) {
  const member = await requireTeamMember();

  const parsed = AvailabilitySchema.safeParse({
    event_id: formData.get("event_id"),
    response: formData.get("response"),
  });

  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("event_availability").upsert(
    {
      event_id: parsed.data.event_id,
      team_member_id: member.id,
      response: parsed.data.response,
      responded_at: new Date().toISOString(),
    },
    { onConflict: "event_id,team_member_id" }
  );

  if (error) return { ok: false, error: "No se pudo registrar tu respuesta." };

  revalidatePath(`/admin/eventos/${parsed.data.event_id}`);
  revalidatePath("/admin/eventos");
  return { ok: true };
}
