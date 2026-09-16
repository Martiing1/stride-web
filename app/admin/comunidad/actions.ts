"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { addPoints, getPointsWeights, notify } from "@/lib/community";
import { matchByName } from "@/lib/attendance-match";

/**
 * Acciones del staff sobre la comunidad: verificar retos, validar medallas
 * físicas, resolver pausas e importar asistencia de Evently. (Crear retos y
 * ajustar puntos se hace en el lugar, dentro de /miembros.)
 */

export interface AdminResult {
  ok: boolean;
  error?: string;
  summary?: string;
}

const err = (error: string): AdminResult => ({ ok: false, error });

// ─── Verificación de retos con evidencia ─────────────────────────────────────

export async function resolveChallengeProgress(
  progressId: string,
  approve: boolean
): Promise<AdminResult> {
  const staff = await requireTeamMember(["socio", "lider_comunidad"]);
  const service = createServiceClient();

  const { data: progress } = await service
    .from("challenge_progress")
    .select("id, member_id, status, challenges:challenge_id(id, title, period, points, medal_id)")
    .eq("id", progressId)
    .maybeSingle();
  if (!progress) return err("No encontramos esa verificación.");
  if (progress.status !== "en_verificacion") return err("Esa evidencia ya fue resuelta.");
  const challenge = progress.challenges as unknown as { id: string; title: string; period: string; points: number; medal_id: string | null };

  if (!approve) {
    await service
      .from("challenge_progress")
      .update({ status: "rechazado", verified_by: staff.id, updated_at: new Date().toISOString() })
      .eq("id", progressId);
    await notify(progress.member_id, {
      title: "Tu evidencia necesita otra vuelta",
      body: `Reto «${challenge.title}»: revisa el feedback en el grupo y vuelve a intentarlo 💪`,
      kind: "reto",
      href: "/miembros/retos",
    });
    revalidatePath("/admin/miembros");
    return { ok: true };
  }

  const { error } = await service
    .from("challenge_progress")
    .update({
      status: "cumplido",
      completed_at: new Date().toISOString(),
      verified_by: staff.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", progressId);
  if (error) return err("No pudimos aprobar.");

  const source =
    challenge.period === "mes" ? "reto_mes" : challenge.period === "semana" ? "micro_reto" : "reto_general";
  // Un micro-reto se paga cada semana: la referencia del candado es la fila semanal.
  await addPoints(progress.member_id, challenge.points, source, `Reto verificado: ${challenge.title}`, challenge.period === "semana" ? progressId : challenge.id);
  if (challenge.medal_id) {
    await service.from("member_medals").insert({
      member_id: progress.member_id,
      medal_id: challenge.medal_id,
      source_challenge_id: challenge.id,
      status: "otorgada",
      awarded_by: staff.id,
    });
  }
  await notify(progress.member_id, {
    title: `¡Reto cumplido! ${challenge.title}`,
    body: `+${challenge.points} pts${challenge.medal_id ? " · medalla a tu vitrina 🏅" : ""}`,
    kind: challenge.medal_id ? "medal" : "reto",
    href: challenge.medal_id ? "/miembros/perfil" : "/miembros/retos",
  });
  revalidatePath("/admin/miembros");
  return { ok: true };
}

// ─── Medallas físicas ────────────────────────────────────────────────────────

export async function resolvePhysicalMedal(medalId: string, approve: boolean): Promise<AdminResult> {
  const staff = await requireTeamMember(["socio", "lider_comunidad"]);
  const service = createServiceClient();

  const { data: medal } = await service
    .from("member_medals")
    .select("id, member_id, title_override, status")
    .eq("id", medalId)
    .maybeSingle();
  if (!medal) return err("No encontramos esa medalla.");
  if (medal.status !== "en_revision") return err("Ya fue resuelta.");

  const { error } = await service
    .from("member_medals")
    .update({ status: approve ? "otorgada" : "rechazada", awarded_by: staff.id })
    .eq("id", medalId);
  if (error) return err("No pudimos resolverla.");

  await notify(medal.member_id, {
    title: approve
      ? `Tu medalla «${medal.title_override}» quedó inmortalizada 🏅`
      : `No pudimos validar «${medal.title_override}»`,
    body: approve ? "Ya brilla en tu vitrina." : "Súbela de nuevo con una foto más clara.",
    kind: "medal",
    href: "/miembros/perfil",
  });
  revalidatePath("/admin/miembros");
  return { ok: true };
}

// ─── Pausas ──────────────────────────────────────────────────────────────────

export async function resolvePause(pauseId: string, approve: boolean): Promise<AdminResult> {
  const staff = await requireTeamMember(["socio", "lider_comunidad"]);
  const service = createServiceClient();

  const { data: pause } = await service
    .from("pause_requests")
    .select("id, member_id, status")
    .eq("id", pauseId)
    .maybeSingle();
  if (!pause) return err("No encontramos esa solicitud.");
  if (pause.status !== "pendiente") return err("Ya fue resuelta.");

  const { error } = await service
    .from("pause_requests")
    .update({ status: approve ? "aprobada" : "rechazada", reviewed_by: staff.id })
    .eq("id", pauseId);
  if (error) return err("No pudimos resolverla.");

  await notify(pause.member_id, {
    title: approve ? "Pausa aprobada ✅" : "Sobre tu solicitud de pausa",
    body: approve
      ? "Tus rachas quedan protegidas. Recupérate tranquilo 💜"
      : "Conversemos por WhatsApp para ver tu caso.",
    kind: "pausa",
    href: "/miembros/perfil",
  });
  revalidatePath("/admin/miembros");
  return { ok: true };
}

// ─── Import de asistencia (export de Evently) ────────────────────────────────

/**
 * Calza asistentes por email con los miembros y registra la asistencia. A cada
 * miembro calzado le paga los puntos del evento (una sola vez) y le avisa por
 * la campana; las filas sin match quedan guardadas para revisarlas.
 *
 * Acepta el .xlsx tal cual lo baja Evently (columnas ID, CI, Nombre, Apellido,
 * Email, …, Fecha de Validación) o filas pegadas/subidas como CSV. En el .xlsx
 * la "Fecha de Validación" es el check-in en la puerta: por defecto solo esos
 * inscritos reciben puntos, porque comprar ticket no es haber ido.
 */
export async function importEventlyCsv(formData: FormData): Promise<AdminResult> {
  const staff = await requireTeamMember(["socio", "lider_comunidad"]);
  const service = createServiceClient();

  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) return err("Elige el evento.");

  const file = formData.get("file");
  const csvText = String(formData.get("csv") ?? "").trim();
  const onlyValidated = String(formData.get("only_validated") ?? "si") !== "no";

  let rows: string[][];
  if (file instanceof File && file.size > 0) {
    if (file.size > 4 * 1024 * 1024) return err("El archivo pesa más de 4 MB; no parece un export de Evently.");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 2).toString("latin1") === "PK") {
      const { readXlsxRows } = await import("@/lib/xlsx-lite");
      try {
        rows = readXlsxRows(buffer);
      } catch {
        return err("No pudimos leer el .xlsx. Exporta de nuevo desde Evently sin abrirlo en Excel.");
      }
    } else {
      rows = parseCsv(buffer.toString("utf8"));
    }
  } else if (csvText) {
    rows = parseCsv(csvText);
  } else {
    return err("Sube el export de Evently (.xlsx o .csv) o pega las filas.");
  }

  const { data: event } = await service
    .from("events")
    .select("id, title, event_type")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return err("Ese evento no existe.");

  if (rows.length < 2) return err("El archivo no trae filas de asistentes.");

  const header = rows[0].map(normalizeHeader);
  const column = (...needles: string[]) => header.findIndex((cell) => needles.some((needle) => cell.includes(needle)));
  const emailIdx = column("mail");
  const nameIdx = column("nombre", "name");
  const lastNameIdx = column("apellido");
  const validatedIdx = column("validacion");
  if (emailIdx === -1) return err("No encontramos la columna de email en el archivo.");

  const allRows = rows.slice(1);
  const validated = validatedIdx >= 0 ? allRows.filter((row) => (row[validatedIdx] ?? "").trim() !== "") : allRows;
  const skipped = allRows.length - validated.length;
  if (onlyValidated && validatedIdx >= 0 && validated.length === 0) {
    return err(
      "Ninguna fila trae «Fecha de Validación»: nadie quedó validado en la puerta. Desmarca «solo los validados» si quieres acreditar a todos los inscritos."
    );
  }
  const attendees = onlyValidated ? validated : allRows;

  const { data: members } = await service.from("members").select("id, email, full_name");
  const byEmail = new Map(
    (members ?? [])
      .filter((m) => m.email)
      .map((m) => [m.email!.trim().toLowerCase(), m])
  );

  // Filas limpias: email + nombre. Si el email no calza con ningún miembro,
  // se intenta por nombre completo (solo cuando no hay ambigüedad).
  const parsed = attendees
    .map((row) => ({
      email: (row[emailIdx] ?? "").trim().toLowerCase(),
      name:
        [nameIdx, lastNameIdx]
          .filter((idx) => idx >= 0)
          .map((idx) => (row[idx] ?? "").trim())
          .filter(Boolean)
          .join(" ") || null,
    }))
    .filter((row) => row.email);
  const byName = matchByName(parsed.filter((row) => !byEmail.has(row.email)), members ?? []);

  let matched = 0;
  let matchedByName = 0;
  let unmatched = 0;
  let duplicated = 0;

  for (const row of parsed) {
    const memberId = byEmail.get(row.email)?.id ?? byName.get(row) ?? null;

    const { error } = await service.from("event_attendance").insert({
      event_id: eventId,
      member_id: memberId,
      attendee_name: row.name,
      attendee_email: row.email,
      source: "evently_csv",
      imported_by: staff.id,
    });

    if (error) {
      if (`${error.code}`.includes("23505")) duplicated++;
      continue;
    }
    if (memberId) {
      matched++;
      if (!byEmail.has(row.email)) matchedByName++;
      await creditAttendance(memberId, event);
    } else {
      unmatched++;
    }
  }

  revalidatePath("/admin/miembros");
  const ignored = onlyValidated && skipped > 0 ? ` · ${skipped} inscritos sin validar en puerta (no se acreditan)` : "";
  const byNameNote = matchedByName > 0 ? ` (${matchedByName} por nombre)` : "";
  return {
    ok: true,
    summary: `${matched} miembros acreditados${byNameNote} · ${unmatched} sin match (enlázalos abajo) · ${duplicated} ya estaban${ignored}`,
  };
}

/** Puntos + aviso por la campana por asistir. Lo comparten el import y el enlace manual. */
async function creditAttendance(memberId: string, event: { id: string; title: string; event_type: string }): Promise<void> {
  const weights = await getPointsWeights();
  const isSocialRun = event.event_type.startsWith("social_run");
  const points = isSocialRun ? weights.social_run : weights.sesion_online;
  await addPoints(memberId, points, isSocialRun ? "social_run" : "sesion_online", `Asistencia: ${event.title}`, event.id);
  await notify(memberId, {
    title: `¡Gracias por venir! ${event.title}`,
    body: `+${points} pts · tu racha sigue viva 🔥`,
    kind: "event",
    href: "/miembros/perfil",
  });
}

/**
 * Enlaza a mano una fila de asistencia sin match con un miembro (se inscribió
 * con otro correo) y le acredita puntos y aviso como si hubiera calzado.
 */
export async function linkAttendance(attendanceId: string, memberId: string): Promise<AdminResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const service = createServiceClient();

  const { data: rowRaw } = await service
    .from("event_attendance")
    .select("id, member_id, events:event_id(id, title, event_type)")
    .eq("id", attendanceId)
    .maybeSingle();
  const row = rowRaw as unknown as {
    id: string; member_id: string | null; events: { id: string; title: string; event_type: string } | null;
  } | null;
  if (!row || !row.events) return err("No encontramos esa fila.");
  if (row.member_id) return err("Esa fila ya está enlazada.");

  const { error } = await service.from("event_attendance").update({ member_id: memberId }).eq("id", attendanceId);
  if (error) {
    if (`${error.code}`.includes("23505")) return err("Ese miembro ya tiene la asistencia de este evento.");
    return err("No pudimos enlazar.");
  }
  await creditAttendance(memberId, row.events);
  revalidatePath("/admin/miembros");
  return { ok: true };
}

/** Encabezado comparable: sin mayúsculas ni tildes. */
function normalizeHeader(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += char;
    } else if (char === '"') inQuotes = true;
    else if (char === "," || char === ";") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}
