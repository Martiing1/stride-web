"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { addPoints, getPointsWeights, notify, DEFAULT_POINTS, type PointsWeights } from "@/lib/community";

/**
 * Acciones del staff sobre la comunidad: verificar retos, validar medallas
 * físicas, resolver pausas, crear retos, importar asistencia de Evently y
 * ajustar los pesos de puntos.
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
    revalidatePath("/admin/comunidad");
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
  await addPoints(progress.member_id, challenge.points, source, `Reto verificado: ${challenge.title}`, challenge.id);
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
    kind: "medal",
    href: "/miembros/perfil",
  });
  revalidatePath("/admin/comunidad");
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
  revalidatePath("/admin/comunidad");
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
  revalidatePath("/admin/comunidad");
  return { ok: true };
}

// ─── Retos: crear / activar ──────────────────────────────────────────────────

export async function createChallenge(formData: FormData): Promise<AdminResult> {
  const staff = await requireTeamMember(["socio", "lider_comunidad"]);
  const service = createServiceClient();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const period = String(formData.get("period") ?? "mes");
  const criterio = String(formData.get("criterio") ?? "cantidad");
  const goal = Math.max(1, Number(formData.get("goal") ?? 1) || 1);
  const points = Math.max(0, Number(formData.get("points") ?? 0) || 0);
  const medalId = String(formData.get("medal_id") ?? "") || null;
  if (!title) return err("Ponle título al reto.");
  if (!["mes", "semana", "hito", "general"].includes(period)) return err("Período inválido.");
  if (!["asistencia", "cantidad", "evidencia"].includes(criterio)) return err("Criterio inválido.");

  const month =
    period === "mes" || period === "semana" ? new Date().toISOString().slice(0, 7) + "-01" : null;

  const { error } = await service.from("challenges").insert({
    title,
    description,
    period,
    criterio,
    goal,
    points,
    medal_id: medalId,
    month,
    created_by: staff.id,
  });
  if (error) return err("No pudimos crear el reto.");
  revalidatePath("/admin/comunidad/retos");
  return { ok: true };
}

export async function toggleChallenge(challengeId: string, active: boolean): Promise<AdminResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const service = createServiceClient();
  const { error } = await service.from("challenges").update({ active }).eq("id", challengeId);
  if (error) return err("No pudimos actualizar el reto.");
  revalidatePath("/admin/comunidad/retos");
  return { ok: true };
}

// ─── Config de puntos ────────────────────────────────────────────────────────

export async function savePointsWeights(input: Partial<PointsWeights>): Promise<AdminResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const service = createServiceClient();

  const clean: PointsWeights = { ...DEFAULT_POINTS };
  for (const key of Object.keys(DEFAULT_POINTS) as Array<keyof PointsWeights>) {
    const value = Number(input[key]);
    if (Number.isFinite(value) && value >= 0 && value <= 1000) clean[key] = Math.round(value);
  }

  const { error } = await service
    .from("community_config")
    .upsert({ key: "points", value: clean, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return err("No pudimos guardar la configuración.");
  revalidatePath("/admin/comunidad/config");
  return { ok: true };
}

// ─── Import de asistencia (CSV de Evently) ───────────────────────────────────

/**
 * Recibe el CSV exportado de Evently, calza asistentes por email con los
 * miembros y registra la asistencia. A cada miembro calzado le paga los
 * puntos de Social Run (una sola vez por evento) y le avisa por la campana.
 * Las filas sin match quedan guardadas con nombre/email para revisarlas.
 */
export async function importEventlyCsv(formData: FormData): Promise<AdminResult> {
  const staff = await requireTeamMember(["socio", "lider_comunidad"]);
  const service = createServiceClient();

  const eventId = String(formData.get("event_id") ?? "");
  const csvText = String(formData.get("csv") ?? "").trim();
  if (!eventId) return err("Elige el evento.");
  if (!csvText) return err("Pega o sube el CSV de Evently.");

  const { data: event } = await service
    .from("events")
    .select("id, title, event_type")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return err("Ese evento no existe.");

  // Parser CSV simple con soporte de comillas (suficiente para Evently).
  const rows = parseCsv(csvText);
  if (rows.length < 2) return err("El CSV no trae filas de asistentes.");

  const header = rows[0].map((cell) => cell.toLowerCase());
  const emailIdx = header.findIndex((cell) => cell.includes("mail"));
  const nameIdx = header.findIndex((cell) => cell.includes("nombre") || cell.includes("name"));
  if (emailIdx === -1) return err("No encontramos la columna de email en el CSV.");

  const { data: members } = await service.from("members").select("id, email, full_name");
  const byEmail = new Map(
    (members ?? [])
      .filter((m) => m.email)
      .map((m) => [m.email!.trim().toLowerCase(), m])
  );

  const weights = await getPointsWeights();
  const isSocialRun = event.event_type.startsWith("social_run");
  let matched = 0;
  let unmatched = 0;
  let duplicated = 0;

  for (const row of rows.slice(1)) {
    const email = (row[emailIdx] ?? "").trim().toLowerCase();
    if (!email) continue;
    const name = nameIdx >= 0 ? (row[nameIdx] ?? "").trim() : "";
    const member = byEmail.get(email);

    const { error } = await service.from("event_attendance").insert({
      event_id: eventId,
      member_id: member?.id ?? null,
      attendee_name: name || null,
      attendee_email: email,
      source: "evently_csv",
      imported_by: staff.id,
    });

    if (error) {
      if (`${error.code}`.includes("23505")) duplicated++;
      continue;
    }
    if (member) {
      matched++;
      await addPoints(
        member.id,
        isSocialRun ? weights.social_run : weights.sesion_online,
        isSocialRun ? "social_run" : "sesion_online",
        `Asistencia: ${event.title}`,
        eventId
      );
      await notify(member.id, {
        title: `¡Gracias por venir! ${event.title}`,
        body: `+${isSocialRun ? weights.social_run : weights.sesion_online} pts · tu racha sigue viva 🔥`,
        kind: "event",
        href: "/miembros/perfil",
      });
    } else {
      unmatched++;
    }
  }

  revalidatePath("/admin/comunidad");
  return {
    ok: true,
    summary: `${matched} miembros acreditados · ${unmatched} sin match (guardados para revisar) · ${duplicated} ya estaban`,
  };
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
