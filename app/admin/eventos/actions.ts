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

const InternalNotesSchema = z.object({
  id: z.string().uuid(),
  internal_notes: z.string().trim().max(4000),
});

/** Notas internas del evento: jamás se muestran en la web pública. */
export async function saveInternalNotes(formData: FormData) {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = InternalNotesSchema.safeParse({
    id: formData.get("id"),
    internal_notes: formData.get("internal_notes") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ internal_notes: parsed.data.internal_notes || null })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudieron guardar las notas." };

  revalidatePath(`/admin/eventos/${parsed.data.id}`);
  return { ok: true };
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  imported?: number;
  validated?: number;
}

/** Normaliza un encabezado del export para encontrar columnas sin pelear con tildes. */
function normalizeHeader(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Importa el export de inscritos de Evently (.xlsx) a un evento.
 *
 * La "Fecha de Validación" del export es el check-in en la puerta: los
 * inscritos con esa fecha son los que efectivamente llegaron. Reimportar el
 * mismo archivo actualiza en vez de duplicar (upsert por ID de Evently).
 */
export async function importRegistrations(formData: FormData): Promise<ImportResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const eventId = z.string().uuid().safeParse(formData.get("event_id"));
  if (!eventId.success) return { ok: false, error: "Evento inválido" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Adjunta el .xlsx exportado desde Evently." };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: "El archivo pesa más de 4 MB; no parece un export de Evently." };

  const { readXlsxRows, excelSerialToIso } = await import("@/lib/xlsx-lite");
  let rows: string[][];
  try {
    rows = readXlsxRows(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { ok: false, error: "No pudimos leer el archivo. Exporta de nuevo desde Evently sin abrirlo en Excel." };
  }
  if (rows.length < 2) return { ok: false, error: "El archivo no trae inscritos." };

  const header = rows[0].map(normalizeHeader);
  const col = (name: string) => header.findIndex((h) => h.startsWith(name));
  const idx = {
    id: col("id"),
    ci: col("ci"),
    nombre: col("nombre"),
    apellido: col("apellido"),
    email: col("email"),
    compra: col("fecha compra"),
    ticket: col("tipo de ticket"),
    estado: col("estado"),
    origen: col("origen"),
    validacion: col("fecha de validacion"),
  };
  if (idx.nombre === -1 || idx.validacion === -1) {
    return { ok: false, error: "El archivo no calza con el export de Evently (faltan las columnas Nombre o Fecha de Validación)." };
  }

  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
  const records = rows.slice(1)
    .filter((row) => cell(row, idx.nombre))
    .map((row, i) => ({
      event_id: eventId.data,
      evently_id: cell(row, idx.id) || `fila-${i + 2}`,
      ci: cell(row, idx.ci) || null,
      first_name: cell(row, idx.nombre),
      last_name: cell(row, idx.apellido) || null,
      email: cell(row, idx.email).toLowerCase() || null,
      ticket_type: cell(row, idx.ticket) || null,
      status: cell(row, idx.estado) || null,
      purchased_at: excelSerialToIso(cell(row, idx.compra)),
      validated_at: excelSerialToIso(cell(row, idx.validacion)),
      source: cell(row, idx.origen) || null,
    }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_registrations")
    .upsert(records, { onConflict: "event_id,evently_id" });
  if (error) return { ok: false, error: "No se pudieron guardar los inscritos. ¿Corriste la migración 004?" };

  revalidatePath(`/admin/eventos/${eventId.data}`);
  revalidatePath("/admin/eventos");
  return {
    ok: true,
    imported: records.length,
    validated: records.filter((r) => r.validated_at).length,
  };
}

export interface EventlyPreviewResult {
  ok: boolean;
  error?: string;
  event?: import("@/lib/evently").EventlyEvent;
}

/** Lee los metadatos públicos de un link de Evently para autocompletar el formulario. */
export async function fetchEventlyMetadata(formData: FormData): Promise<EventlyPreviewResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const url = z.string().trim().url().max(500).safeParse(formData.get("url"));
  if (!url.success) return { ok: false, error: "Pega primero el link de Evently." };

  const { fetchEventlyEvent } = await import("@/lib/evently");
  try {
    const event = await fetchEventlyEvent(url.data);
    if (!event) return { ok: false, error: "Ese link no parece un evento de Evently." };
    return { ok: true, event };
  } catch {
    return { ok: false, error: "No pudimos leer la página de Evently. Intenta de nuevo." };
  }
}

const EventlyUrlSchema = z.object({
  id: z.string().uuid(),
  evently_url: z.string().trim().url("Link inválido").max(500).or(z.literal("")),
});

/**
 * Guarda (o corrige) el link de Evently después de creado el evento. Antes
 * solo se podía poner al crearlo, y un evento sin link quedaba imposible de
 * publicar sin recrearlo. Quitar el link despublica: la regla de "no mostrar
 * nada sin inscripción" se mantiene sola.
 */
export async function setEventlyUrl(formData: FormData) {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = EventlyUrlSchema.safeParse({
    id: formData.get("id"),
    evently_url: formData.get("evently_url") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Link inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      evently_url: parsed.data.evently_url || null,
      ...(parsed.data.evently_url ? {} : { is_public: false }),
    })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudo guardar el link." };

  revalidatePath(`/admin/eventos/${parsed.data.id}`);
  revalidatePath("/admin/eventos");
  revalidatePath("/eventos");
  revalidatePath("/");
  return { ok: true };
}
