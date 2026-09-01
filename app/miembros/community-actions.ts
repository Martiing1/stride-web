"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentMember, getCommunityStaff } from "@/lib/member-auth";
import { todayInChile } from "@/lib/membership";
import { addPoints, getPointsWeights, notify, MAX_HABITS, type Channel } from "@/lib/community";
import { detectImage, detectVideo } from "@/lib/uploads";

/**
 * Acciones de la comunidad (lado miembro). Todas parten igual: se resuelve el
 * miembro por sesión OTP y se opera con service role. Los puntos jamás botan
 * la acción principal (addPoints traga sus propios errores).
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Aviso no bloqueante (ej: el post salió pero el reto no avanzó). */
  info?: string;
  /** Para el efecto wow al completar un reto. */
  completed?: { title: string; points: number; medal: { name: string; rarity: string; emoji: string } | null };
}

const err = (error: string): ActionResult => ({ ok: false, error });

// ─── Blog ────────────────────────────────────────────────────────────────────

export async function createPost(formData: FormData): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció. Vuelve a ingresar.");

  const body = String(formData.get("body") ?? "").trim();
  const channelRaw = String(formData.get("channel") ?? "general");
  const channel: Channel = ["general", "logros", "presentacion"].includes(channelRaw)
    ? (channelRaw as Channel)
    : "general";
  if (!body) return err("Escribe algo primero.");
  if (body.length > 4000) return err("Máximo 4.000 caracteres.");

  const service = createServiceClient();
  const photoPaths: string[] = [];

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > 4) return err("Máximo 4 fotos por publicación.");
  for (const file of photos) {
    if (file.size > 8 * 1024 * 1024) return err("Cada foto debe pesar menos de 8 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectImage(bytes);
    if (!detected) return err("Usa imágenes JPEG, PNG o WebP.");
    const path = `${member.id}/${randomUUID()}.${detected.extension}`;
    const { error } = await service.storage
      .from("post-photos")
      .upload(path, bytes, { contentType: detected.mime, cacheControl: "3600" });
    if (error) return err("No pudimos subir la foto.");
    photoPaths.push(path);
  }

  const { data: post, error } = await service
    .from("community_posts")
    .insert({ author_member_id: member.id, channel, body, photo_paths: photoPaths })
    .select("id")
    .single();
  if (error || !post) return err("No pudimos publicar. Intenta de nuevo.");

  const weights = await getPointsWeights();
  await addPoints(member.id, weights.post, "post", "Publicación en el blog", post.id);

  // ── @reto: publicar con un reto mencionado avanza el reto desde el blog ──
  const challengeId = String(formData.get("challengeId") ?? "");
  if (challengeId) {
    const { data: challenge } = await service
      .from("challenges")
      .select("id, criterio, title")
      .eq("id", challengeId)
      .eq("active", true)
      .maybeSingle();

    if (!challenge) {
      revalidatePath("/miembros");
      return { ok: true, info: "El post salió, pero ese reto ya no está activo." };
    }

    if (challenge.criterio === "cantidad") {
      const result = await reportChallenge(challengeId, null);
      revalidatePath("/miembros");
      return result.completed ? { ok: true, completed: result.completed } : { ok: true, info: result.ok ? "Avance del reto registrado desde tu post ✓" : result.error };
    }

    if (challenge.criterio === "evidencia") {
      if (photoPaths.length === 0) {
        revalidatePath("/miembros");
        return { ok: true, info: "El post salió; para avanzar ese reto adjunta una foto como evidencia." };
      }
      // Copia la primera foto del post al bucket de evidencia para el staff.
      const { data: file } = await service.storage.from("post-photos").download(photoPaths[0]);
      if (file) {
        const evidencePath = `${member.auth_user_id}/${challengeId}/${randomUUID()}.jpg`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { error: copyError } = await service.storage
          .from("evidence")
          .upload(evidencePath, bytes, { contentType: file.type || "image/jpeg" });
        if (!copyError) {
          await service.from("challenge_progress").upsert(
            {
              challenge_id: challengeId,
              member_id: member.id,
              evidence_path: evidencePath,
              status: "en_verificacion",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "challenge_id,member_id" }
          );
          revalidatePath("/miembros");
          return { ok: true, info: `Tu foto quedó como evidencia de «${challenge.title}» — el staff la revisa ✓` };
        }
      }
      revalidatePath("/miembros");
      return { ok: true, info: "El post salió, pero no pudimos registrar la evidencia del reto." };
    }

    revalidatePath("/miembros");
    return { ok: true, info: "El post salió; ese reto se valida solo con tu asistencia." };
  }

  revalidatePath("/miembros");
  return { ok: true };
}

export async function toggleLike(postId: string): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const service = createServiceClient();

  const { data: existing } = await service
    .from("community_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("member_id", member.id)
    .maybeSingle();

  const { data: post } = await service
    .from("community_posts")
    .select("author_member_id")
    .eq("id", postId)
    .maybeSingle();
  const weights = await getPointsWeights();

  if (existing) {
    await service.from("community_likes").delete().eq("post_id", postId).eq("member_id", member.id);
    // Farming-proof: el unlike descuenta lo que el like pagó.
    if (post?.author_member_id && post.author_member_id !== member.id)
      await addPoints(post.author_member_id, -weights.like_received, "like_received", "Like retirado");
  } else {
    const { error } = await service
      .from("community_likes")
      .insert({ post_id: postId, member_id: member.id });
    if (error) return err("No pudimos guardar tu like.");
    if (post?.author_member_id && post.author_member_id !== member.id)
      await addPoints(post.author_member_id, weights.like_received, "like_received", "Like recibido");
  }
  revalidatePath("/miembros");
  return { ok: true };
}

export async function addComment(
  postId: string,
  body: string,
  parentId?: string | null
): Promise<ActionResult> {
  const member = await getCurrentMember();
  const staff = member ? null : await getCommunityStaff();
  if (!member && !staff) return err("Tu sesión venció.");
  const text = body.trim();
  if (!text) return err("Escribe algo primero.");
  if (text.length > 1000) return err("Máximo 1.000 caracteres.");

  const service = createServiceClient();
  // parent_id solo se incluye al responder: así comentar normal no depende de
  // la migración 013.
  const payload: Record<string, unknown> = member
    ? { post_id: postId, author_member_id: member.id, body: text }
    : { post_id: postId, author_team_member_id: staff!.id, body: text };
  if (parentId) payload.parent_id = parentId;
  const { data: comment, error } = await service
    .from("community_comments")
    .insert(payload)
    .select("id")
    .single();
  if (error || !comment) {
    return err(
      parentId && `${error?.message}`.includes("parent_id")
        ? "Responder en hilo requiere la migración 013."
        : "No pudimos guardar el comentario."
    );
  }

  if (member) {
    const weights = await getPointsWeights();
    await addPoints(member.id, weights.comment, "comment", "Comentario", comment.id);
  }

  const { data: post } = await service
    .from("community_posts")
    .select("author_member_id")
    .eq("id", postId)
    .maybeSingle();
  const commenterName = member ? member.full_name.split(" ")[0] : staff!.nickname ?? "STRIDE";
  if (post?.author_member_id && post.author_member_id !== member?.id) {
    await notify(post.author_member_id, {
      title: `${commenterName} comentó tu publicación`,
      body: text.slice(0, 80),
      kind: "comment",
      href: "/miembros",
    });
  }
  revalidatePath("/miembros");
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODO ADMIN (staff en /miembros): publicar como STRIDE, fijar, borrar y
// editar el classroom. Guardadas con requireTeamMember vía getCommunityStaff.
// ═══════════════════════════════════════════════════════════════════════════

async function requireStaff() {
  const staff = await getCommunityStaff();
  if (!staff) throw new Error("Solo el staff puede hacer esto.");
  return staff;
}

/** Publica un comunicado como STRIDE (puede ir fijado y con video). */
export async function staffCreatePost(formData: FormData): Promise<ActionResult> {
  let staff;
  try {
    staff = await requireStaff();
  } catch {
    return err("Solo el staff puede publicar como STRIDE.");
  }

  const body = String(formData.get("body") ?? "").trim();
  const channelRaw = String(formData.get("channel") ?? "general");
  const channel: Channel = ["general", "logros", "presentacion"].includes(channelRaw)
    ? (channelRaw as Channel)
    : "general";
  const title = String(formData.get("title") ?? "").trim() || null;
  const pinned = formData.get("pinned") === "true";
  const videoRaw = String(formData.get("videoUrl") ?? "").trim();
  if (!body) return err("Escribe el comunicado primero.");

  // Acepta URLs de YouTube en cualquier formato y las normaliza a /embed/.
  let video_url: string | null = null;
  if (videoRaw) {
    const match = videoRaw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    if (!match) return err("El video debe ser un link de YouTube.");
    video_url = `https://www.youtube.com/embed/${match[1]}`;
  }

  const service = createServiceClient();
  const photoPaths: string[] = [];
  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of photos.slice(0, 4)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectImage(bytes);
    if (!detected) return err("Usa imágenes JPEG, PNG o WebP.");
    const path = `staff/${randomUUID()}.${detected.extension}`;
    const { error } = await service.storage
      .from("post-photos")
      .upload(path, bytes, { contentType: detected.mime, cacheControl: "3600" });
    if (error) return err("No pudimos subir la foto.");
    photoPaths.push(path);
  }

  const { error } = await service.from("community_posts").insert({
    author_team_member_id: staff.id,
    channel,
    title,
    body,
    photo_paths: photoPaths,
    video_url,
    is_pinned: pinned,
  });
  if (error) return err("No pudimos publicar el comunicado.");
  revalidatePath("/miembros");
  return { ok: true };
}

export async function staffTogglePin(postId: string): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch {
    return err("Solo el staff puede fijar publicaciones.");
  }
  const service = createServiceClient();
  const { data: post } = await service.from("community_posts").select("is_pinned").eq("id", postId).maybeSingle();
  if (!post) return err("Publicación no encontrada.");
  const { error } = await service.from("community_posts").update({ is_pinned: !post.is_pinned }).eq("id", postId);
  if (error) return err("No pudimos actualizar el fijado.");
  revalidatePath("/miembros");
  return { ok: true };
}

export async function staffDeletePost(postId: string): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch {
    return err("Solo el staff puede eliminar publicaciones.");
  }
  const service = createServiceClient();
  const { data: post } = await service.from("community_posts").select("photo_paths").eq("id", postId).maybeSingle();
  const { error } = await service.from("community_posts").delete().eq("id", postId);
  if (error) return err("No pudimos eliminar la publicación.");
  if (post?.photo_paths?.length) await service.storage.from("post-photos").remove(post.photo_paths);
  revalidatePath("/miembros");
  return { ok: true };
}

/** Crea o edita una lección del classroom. */
export async function saveLesson(input: {
  id?: string;
  courseId: string;
  title: string;
  duration_label: string;
  video_url: string;
  content_md: string;
}): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch {
    return err("Solo el staff puede editar el classroom.");
  }
  const title = input.title.trim();
  if (!title) return err("Ponle título a la lección.");

  let video_url: string | null = null;
  const videoRaw = input.video_url.trim();
  if (videoRaw) {
    const match = videoRaw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    if (!match) return err("El video debe ser un link de YouTube.");
    video_url = `https://www.youtube.com/embed/${match[1]}`;
  }

  const service = createServiceClient();
  const payload = {
    title,
    duration_label: input.duration_label.trim() || null,
    video_url,
    content_md: input.content_md.trim() || null,
  };

  if (input.id) {
    const { error } = await service.from("course_lessons").update(payload).eq("id", input.id);
    if (error) return err("No pudimos guardar la lección.");
  } else {
    const { count } = await service
      .from("course_lessons")
      .select("id", { count: "exact", head: true })
      .eq("course_id", input.courseId);
    const { error } = await service
      .from("course_lessons")
      .insert({ ...payload, course_id: input.courseId, sort_order: count ?? 0 });
    if (error) return err("No pudimos crear la lección.");
  }
  revalidatePath("/miembros/classroom");
  return { ok: true };
}

export async function deleteLesson(lessonId: string): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch {
    return err("Solo el staff puede editar el classroom.");
  }
  const service = createServiceClient();
  const { error } = await service.from("course_lessons").delete().eq("id", lessonId);
  if (error) return err("No pudimos eliminar la lección.");
  revalidatePath("/miembros/classroom");
  return { ok: true };
}

/** Mueve una lección hacia arriba o abajo dentro de su curso. */
export async function moveLesson(lessonId: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch {
    return err("Solo el staff puede editar el classroom.");
  }
  const service = createServiceClient();
  const { data: lesson } = await service
    .from("course_lessons")
    .select("id, course_id, sort_order")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return err("Lección no encontrada.");

  const { data: siblings } = await service
    .from("course_lessons")
    .select("id, sort_order")
    .eq("course_id", lesson.course_id)
    .order("sort_order");
  if (!siblings) return err("No pudimos reordenar.");

  const index = siblings.findIndex((s) => s.id === lessonId);
  const swapWith = direction === "up" ? siblings[index - 1] : siblings[index + 1];
  if (!swapWith) return { ok: true };

  await service.from("course_lessons").update({ sort_order: swapWith.sort_order }).eq("id", lesson.id);
  await service.from("course_lessons").update({ sort_order: lesson.sort_order }).eq("id", swapWith.id);
  revalidatePath("/miembros/classroom");
  return { ok: true };
}

// ─── Hábitos ─────────────────────────────────────────────────────────────────

export async function saveHabit(input: {
  id?: string;
  name: string;
  emoji: string;
  color: string;
}): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const name = input.name.trim();
  if (!name) return err("Ponle nombre al hábito.");
  if (name.length > 40) return err("Máximo 40 caracteres.");

  const service = createServiceClient();
  if (input.id) {
    const { error } = await service
      .from("habits")
      .update({ name, emoji: input.emoji.slice(0, 8) || "✅", color: input.color })
      .eq("id", input.id)
      .eq("member_id", member.id);
    if (error) return err("No pudimos guardar el hábito.");
  } else {
    const { count } = await service
      .from("habits")
      .select("id", { count: "exact", head: true })
      .eq("member_id", member.id)
      .eq("active", true);
    if ((count ?? 0) >= MAX_HABITS) return err(`Máximo ${MAX_HABITS} hábitos. Edita o elimina uno.`);
    const { error } = await service.from("habits").insert({
      member_id: member.id,
      name,
      emoji: input.emoji.slice(0, 8) || "✅",
      color: input.color,
      sort_order: count ?? 0,
    });
    if (error) return err("No pudimos crear el hábito.");
  }
  revalidatePath("/miembros");
  return { ok: true };
}

export async function deleteHabit(habitId: string): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const service = createServiceClient();
  const { error } = await service
    .from("habits")
    .update({ active: false })
    .eq("id", habitId)
    .eq("member_id", member.id);
  if (error) return err("No pudimos eliminar el hábito.");
  revalidatePath("/miembros");
  return { ok: true };
}

export async function toggleHabitToday(habitId: string): Promise<ActionResult & { allDone?: boolean; streak?: number }> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const service = createServiceClient();
  const today = todayInChile();

  const { data: habit } = await service
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("member_id", member.id)
    .eq("active", true)
    .maybeSingle();
  if (!habit) return err("Ese hábito no existe.");

  const { data: existing } = await service
    .from("habit_logs")
    .select("id")
    .eq("habit_id", habitId)
    .eq("log_date", today)
    .maybeSingle();

  if (existing) {
    await service.from("habit_logs").delete().eq("id", existing.id);
  } else {
    const { error } = await service
      .from("habit_logs")
      .insert({ habit_id: habitId, member_id: member.id, log_date: today });
    if (error && !`${error.code}`.includes("23505")) return err("No pudimos registrar el hábito.");
  }

  // ¿Quedó el día completo? (todos los hábitos activos con log de hoy)
  const [{ count: total }, { count: done }] = await Promise.all([
    service.from("habits").select("id", { count: "exact", head: true }).eq("member_id", member.id).eq("active", true),
    service.from("habit_logs").select("id", { count: "exact", head: true }).eq("member_id", member.id).eq("log_date", today),
  ]);
  const allDone = (total ?? 0) > 0 && (done ?? 0) >= (total ?? 0);

  if (allDone && !existing) {
    // Paga una sola vez por día (se revisa el ledger del día en Chile).
    const weights = await getPointsWeights();
    const { data: paid } = await service
      .from("points_ledger")
      .select("id")
      .eq("member_id", member.id)
      .eq("source", "habitos_dia")
      .gte("created_at", `${today}T00:00:00-04:00`)
      .limit(1);
    if (!paid || paid.length === 0)
      await addPoints(member.id, weights.habitos_dia, "habitos_dia", `Hábitos completos ${today}`);
  }

  revalidatePath("/miembros");
  return { ok: true, allDone };
}

// ─── Pausa ───────────────────────────────────────────────────────────────────

export async function requestPause(note: string): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const text = note.trim();
  if (!text) return err("Cuéntanos el motivo.");

  const service = createServiceClient();
  const { data: pending } = await service
    .from("pause_requests")
    .select("id")
    .eq("member_id", member.id)
    .eq("status", "pendiente")
    .maybeSingle();
  if (pending) return err("Ya tienes una solicitud pendiente.");

  const { error } = await service
    .from("pause_requests")
    .insert({ member_id: member.id, note: text, start_date: todayInChile() });
  if (error) return err("No pudimos enviar la solicitud.");
  revalidatePath("/miembros/perfil");
  return { ok: true };
}

// ─── Eventos ─────────────────────────────────────────────────────────────────

export async function rsvpEvent(eventId: string, response: "voy" | "no_voy"): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const service = createServiceClient();
  const { error } = await service
    .from("event_rsvps")
    .upsert({ event_id: eventId, member_id: member.id, response }, { onConflict: "event_id,member_id" });
  if (error) return err("No pudimos guardar tu respuesta.");
  revalidatePath("/miembros/calendario");
  return { ok: true };
}

// ─── Retos ───────────────────────────────────────────────────────────────────

/**
 * "+1 entrenamiento" con evidencia opcional: el popup del reto permite
 * adjuntar una foto que queda guardada junto al progreso (el staff la puede
 * mirar al premiar).
 */
export async function reportTraining(formData: FormData): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const challengeId = String(formData.get("challengeId") ?? "");
  const file = formData.get("evidence");

  let evidencePath: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 25 * 1024 * 1024) return err("La evidencia debe pesar menos de 25 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectImage(bytes) ?? detectVideo(bytes);
    if (!detected) return err("Sube una imagen o un video MP4/MOV.");
    const service = createServiceClient();
    const path = `${member.auth_user_id}/${challengeId}/${randomUUID()}.${detected.extension}`;
    const { error } = await service.storage
      .from("evidence")
      .upload(path, bytes, { contentType: detected.mime });
    if (error) return err("No pudimos subir la evidencia.");
    evidencePath = path;
  }

  return reportChallenge(challengeId, evidencePath);
}

export async function reportChallenge(
  challengeId: string,
  evidencePath?: string | null
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const service = createServiceClient();

  const { data: challengeRaw } = await service
    .from("challenges")
    .select("id, title, criterio, period, goal, points, medal_id, medals:medal_id(name, rarity, emoji)")
    .eq("id", challengeId)
    .eq("active", true)
    .maybeSingle();
  const challenge = challengeRaw as unknown as {
    id: string; title: string; criterio: string; period: string; goal: number; points: number;
    medal_id: string | null; medals: { name: string; rarity: string; emoji: string } | null;
  } | null;
  if (!challenge) return err("Ese reto ya no está activo.");
  if (challenge.criterio !== "cantidad") return err("Este reto no se avanza con el botón.");

  const { data: progress } = await service
    .from("challenge_progress")
    .upsert(
      { challenge_id: challengeId, member_id: member.id },
      { onConflict: "challenge_id,member_id", ignoreDuplicates: true }
    )
    .select("id, count, status")
    .maybeSingle();

  const { data: row } = progress
    ? { data: progress }
    : await service
        .from("challenge_progress")
        .select("id, count, status")
        .eq("challenge_id", challengeId)
        .eq("member_id", member.id)
        .single();
  if (!row) return err("No pudimos registrar tu avance.");
  if (row.status === "cumplido") return err("¡Este reto ya lo cumpliste!");

  const newCount = row.count + 1;
  const completed = newCount >= challenge.goal;
  const updatePayload: Record<string, unknown> = {
    count: newCount,
    status: completed ? "cumplido" : "en_curso",
    completed_at: completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (evidencePath) updatePayload.evidence_path = evidencePath;
  const { error } = await service.from("challenge_progress").update(updatePayload).eq("id", row.id);
  if (error) return err("No pudimos registrar tu avance.");

  if (completed) {
    const source =
      challenge.period === "mes" ? "reto_mes" : challenge.period === "semana" ? "micro_reto" : "reto_general";
    await addPoints(member.id, challenge.points, source, `Reto cumplido: ${challenge.title}`, challenge.id);

    let medal: { name: string; rarity: string; emoji: string } | null = null;
    if (challenge.medal_id) {
      const { data: awarded } = await service
        .from("member_medals")
        .insert({
          member_id: member.id,
          medal_id: challenge.medal_id,
          source_challenge_id: challenge.id,
          status: "otorgada",
        })
        .select("id")
        .maybeSingle();
      if (awarded) medal = challenge.medals;
    }
    await notify(member.id, {
      title: `¡Reto cumplido! ${challenge.title}`,
      body: `+${challenge.points} pts${challenge.medal_id ? " · medalla a tu vitrina" : ""}`,
      kind: "reto",
      href: "/miembros/perfil",
    });
    revalidatePath("/miembros/retos");
    return { ok: true, completed: { title: challenge.title, points: challenge.points, medal } };
  }

  revalidatePath("/miembros/retos");
  return { ok: true };
}

export async function uploadEvidence(formData: FormData): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const challengeId = String(formData.get("challengeId") ?? "");
  const file = formData.get("evidence");
  if (!(file instanceof File) || file.size === 0) return err("Adjunta tu evidencia.");
  if (file.size > 25 * 1024 * 1024) return err("Máximo 25 MB.");

  const service = createServiceClient();
  const { data: challenge } = await service
    .from("challenges")
    .select("id, criterio")
    .eq("id", challengeId)
    .eq("active", true)
    .maybeSingle();
  if (!challenge || challenge.criterio !== "evidencia") return err("Ese reto no recibe evidencia.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes) ?? detectVideo(bytes);
  if (!detected) return err("Sube una imagen o un video MP4/MOV.");

  const path = `${member.auth_user_id}/${challengeId}/${randomUUID()}.${detected.extension}`;
  const { error: uploadError } = await service.storage
    .from("evidence")
    .upload(path, bytes, { contentType: detected.mime });
  if (uploadError) return err("No pudimos subir la evidencia.");

  const { error } = await service.from("challenge_progress").upsert(
    {
      challenge_id: challengeId,
      member_id: member.id,
      evidence_path: path,
      status: "en_verificacion",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "challenge_id,member_id" }
  );
  if (error) return err("No pudimos registrar la evidencia.");
  revalidatePath("/miembros/retos");
  return { ok: true };
}

// ─── Medallas físicas ────────────────────────────────────────────────────────

export async function uploadPhysicalMedal(formData: FormData): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("photo");
  if (!title) return err("Ponle nombre a tu medalla (ej: 10K Viña 2026).");
  if (!(file instanceof File) || file.size === 0) return err("Sube la foto de tu medalla.");
  if (file.size > 8 * 1024 * 1024) return err("La foto debe pesar menos de 8 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected) return err("Usa una imagen JPEG, PNG o WebP.");

  const service = createServiceClient();
  const path = `${member.id}/${randomUUID()}.${detected.extension}`;
  const { error: uploadError } = await service.storage
    .from("medal-photos")
    .upload(path, bytes, { contentType: detected.mime });
  if (uploadError) return err("No pudimos subir la foto.");

  const { error } = await service.from("member_medals").insert({
    member_id: member.id,
    title_override: title.slice(0, 80),
    photo_path: path,
    is_physical: true,
    status: "en_revision",
  });
  if (error) return err("No pudimos registrar la medalla.");
  revalidatePath("/miembros/perfil");
  return { ok: true };
}

export async function publishMedalPost(memberMedalId: string): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const service = createServiceClient();

  const { data: medalRaw } = await service
    .from("member_medals")
    .select("id, member_id, title_override, medals:medal_id(name)")
    .eq("id", memberMedalId)
    .eq("member_id", member.id)
    .maybeSingle();
  const medal = medalRaw as unknown as {
    id: string; member_id: string; title_override: string | null; medals: { name: string } | null;
  } | null;
  if (!medal) return err("Esa medalla no está en tu vitrina.");

  const name = medal.medals?.name ?? medal.title_override ?? "una medalla";
  const { data: post, error } = await service
    .from("community_posts")
    .insert({
      author_member_id: member.id,
      channel: "logros",
      body: `¡Acabo de ganar la medalla «${name}»! 🏅`,
      member_medal_id: medal.id,
    })
    .select("id")
    .single();
  if (error || !post) return err("No pudimos publicar tu logro.");

  const weights = await getPointsWeights();
  await addPoints(member.id, weights.post, "post", "Publicación de logro", post.id);
  revalidatePath("/miembros");
  return { ok: true };
}

/** Recuerdo de una medalla: nota + foto opcional para "inmortalizar el momento". */
export async function saveMedalMemory(formData: FormData): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const medalId = String(formData.get("medalId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 280);
  const photo = formData.get("photo");

  const service = createServiceClient();
  const { data: medal } = await service
    .from("member_medals")
    .select("id, photo_path")
    .eq("id", medalId)
    .eq("member_id", member.id)
    .maybeSingle();
  if (!medal) return err("Esa medalla no está en tu vitrina.");

  const update: Record<string, unknown> = { note: note || null };

  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 8 * 1024 * 1024) return err("La foto debe pesar menos de 8 MB.");
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const detected = detectImage(bytes);
    if (!detected) return err("Usa una imagen JPEG, PNG o WebP.");
    const path = `${member.id}/${randomUUID()}.${detected.extension}`;
    const { error: uploadError } = await service.storage
      .from("medal-photos")
      .upload(path, bytes, { contentType: detected.mime });
    if (uploadError) return err("No pudimos subir la foto.");
    update.photo_path = path;
  }

  const { error } = await service.from("member_medals").update(update).eq("id", medal.id);
  if (error) {
    return err(
      `${error.message}`.includes("note")
        ? "Falta ejecutar la migración 013 (columna note)."
        : "No pudimos guardar el recuerdo."
    );
  }
  // Foto anterior: se limpia después de reemplazarla.
  if (update.photo_path && medal.photo_path) {
    await service.storage.from("medal-photos").remove([medal.photo_path]);
  }
  revalidatePath("/miembros/perfil");
  return { ok: true };
}

// ─── Notificaciones / classroom ──────────────────────────────────────────────

export async function markNotificationsRead(): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const service = createServiceClient();
  await service.from("notifications").update({ read: true }).eq("member_id", member.id).eq("read", false);
  revalidatePath("/miembros");
  return { ok: true };
}

export async function toggleLesson(lessonId: string, done: boolean): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const service = createServiceClient();
  if (done) {
    const { error } = await service
      .from("lesson_progress")
      .upsert({ lesson_id: lessonId, member_id: member.id }, { onConflict: "lesson_id,member_id" });
    if (error) return err("No pudimos guardar tu avance.");
  } else {
    await service.from("lesson_progress").delete().eq("lesson_id", lessonId).eq("member_id", member.id);
  }
  revalidatePath("/miembros/classroom");
  return { ok: true };
}
