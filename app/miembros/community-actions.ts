"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentMember, getCommunityStaff } from "@/lib/member-auth";
import { NO_WEEK, todayInChile, weekStartChile } from "@/lib/membership";
import { addPoints, getPointsWeights, notify, MAX_HABITS, DEFAULT_POINTS, memberDisplayName, type Channel, type PointsWeights } from "@/lib/community";
import { detectImage, detectVideo } from "@/lib/uploads";
import { notifyStaffReview } from "@/lib/resend";

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
  completed?: {
    title: string;
    points: number;
    medal: { name: string; rarity: string; emoji: string } | null;
    /** Fila de member_medals recién creada: sirve para publicarla al blog desde el popup. */
    memberMedalId?: string | null;
  };
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
  if (photos.length > 5) return err("Máximo 5 fotos por publicación.");
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
      .select("id, criterio, title, period")
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
              week_start: challenge.period === "semana" ? weekStartChile() : NO_WEEK,
              evidence_path: evidencePath,
              status: "en_verificacion",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "challenge_id,member_id,week_start" }
          );
          await notifyStaffReview({ kind: "reto", memberName: memberDisplayName(member), title: challenge.title });
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
  const staff = member ? null : await getCommunityStaff();
  if (!member && !staff) return err("Tu sesión venció.");
  const service = createServiceClient();
  // El like es del miembro o, si entra alguien del equipo sin ficha, de su team_member (migración 021).
  const liker = member ? { column: "member_id", id: member.id } : { column: "team_member_id", id: staff!.id };

  const { data: existing } = await service
    .from("community_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq(liker.column, liker.id)
    .maybeSingle();

  const { data: post } = await service
    .from("community_posts")
    .select("author_member_id")
    .eq("id", postId)
    .maybeSingle();
  const weights = await getPointsWeights();

  if (existing) {
    await service.from("community_likes").delete().eq("post_id", postId).eq(liker.column, liker.id);
    // Farming-proof: el unlike descuenta lo que el like pagó.
    if (post?.author_member_id && post.author_member_id !== member?.id)
      await addPoints(post.author_member_id, -weights.like_received, "like_received", "Like retirado");
  } else {
    const { error } = await service
      .from("community_likes")
      .insert({ post_id: postId, [liker.column]: liker.id });
    if (error) return err("No pudimos guardar tu like.");
    if (post?.author_member_id && post.author_member_id !== member?.id)
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
  const commenterName = member ? memberDisplayName(member).split(" ")[0] : staff!.nickname ?? "STRIDE";
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
}): Promise<ActionResult & { habit?: { id: string; name: string; emoji: string; color: string; sort_order: number } }> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión venció.");
  const name = input.name.trim();
  if (!name) return err("Ponle nombre al hábito.");
  if (name.length > 40) return err("Máximo 40 caracteres.");

  const service = createServiceClient();
  if (input.id) {
    // El id tiene que ser un uuid de verdad: si el widget todavía no recibió el
    // id real del servidor, se pide recargar en vez de reventar contra Postgres.
    if (!/^[0-9a-f-]{36}$/i.test(input.id)) return err("Recarga la página y vuelve a intentarlo.");
    const { data: updated, error } = await service
      .from("habits")
      .update({ name, emoji: input.emoji.slice(0, 8) || "✅", color: input.color })
      .eq("id", input.id)
      .eq("member_id", member.id)
      .select("id, name, emoji, color, sort_order")
      .maybeSingle();
    if (error || !updated) return err("No pudimos guardar el hábito.");
    revalidatePath("/miembros");
    return { ok: true, habit: updated };
  } else {
    const { count } = await service
      .from("habits")
      .select("id", { count: "exact", head: true })
      .eq("member_id", member.id)
      .eq("active", true);
    if ((count ?? 0) >= MAX_HABITS) return err(`Máximo ${MAX_HABITS} hábitos. Edita o elimina uno.`);
    const { data: created, error } = await service
      .from("habits")
      .insert({
        member_id: member.id,
        name,
        emoji: input.emoji.slice(0, 8) || "✅",
        color: input.color,
        sort_order: count ?? 0,
      })
      .select("id, name, emoji, color, sort_order")
      .single();
    if (error || !created) return err("No pudimos crear el hábito.");
    revalidatePath("/miembros");
    return { ok: true, habit: created };
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
  await notifyStaffReview({ kind: "pausa", memberName: memberDisplayName(member), title: text.slice(0, 80) });
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

  // Los micro-retos se avanzan en la semana en curso (se reinician cada lunes).
  const weekStart = challenge.period === "semana" ? weekStartChile() : NO_WEEK;
  const { data: progress } = await service
    .from("challenge_progress")
    .upsert(
      { challenge_id: challengeId, member_id: member.id, week_start: weekStart },
      { onConflict: "challenge_id,member_id,week_start", ignoreDuplicates: true }
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
        .eq("week_start", weekStart)
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
    // Un micro-reto se paga cada semana: el candado anti-duplicados apunta a la fila semanal.
    await addPoints(member.id, challenge.points, source, `Reto cumplido: ${challenge.title}`, challenge.period === "semana" ? row.id : challenge.id);

    let medal: { name: string; rarity: string; emoji: string } | null = null;
    let memberMedalId: string | null = null;
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
      if (awarded) {
        medal = challenge.medals;
        memberMedalId = awarded.id;
      }
    }
    await notify(member.id, {
      title: `¡Reto cumplido! ${challenge.title}`,
      body: `+${challenge.points} pts${challenge.medal_id ? " · medalla a tu vitrina" : ""}`,
      kind: "reto",
      href: "/miembros/perfil",
    });
    revalidatePath("/miembros/retos");
    return { ok: true, completed: { title: challenge.title, points: challenge.points, medal, memberMedalId } };
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
    .select("id, criterio, period, title")
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
      week_start: challenge.period === "semana" ? weekStartChile() : NO_WEEK,
      evidence_path: path,
      status: "en_verificacion",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "challenge_id,member_id,week_start" }
  );
  if (error) return err("No pudimos registrar la evidencia.");
  await notifyStaffReview({ kind: "reto", memberName: memberDisplayName(member), title: challenge.title });
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
  await notifyStaffReview({ kind: "medalla", memberName: memberDisplayName(member), title: title.slice(0, 80) });
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

// ─── Staff · calendario ──────────────────────────────────────────────────────

const EVENT_TYPES = ["social_run", "social_run_cafeteria", "social_run_sunset", "sesion_online", "club_lectura", "marca", "retiro", "race_trip", "otro"];

/** Crea o edita un evento del calendario sin salir de /miembros. */
export async function staffSaveEvent(formData: FormData): Promise<ActionResult> {
  let staff;
  try {
    staff = await requireStaff();
  } catch {
    return err("Solo el staff puede gestionar eventos.");
  }
  const service = createServiceClient();

  const id = String(formData.get("id") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const eventType = String(formData.get("event_type") ?? "social_run");
  const eventDate = String(formData.get("event_date") ?? "");
  const eventTime = String(formData.get("event_time") ?? "") || null;
  const meetingPoint = String(formData.get("meeting_point") ?? "").trim() || null;
  const meetUrl = String(formData.get("meet_url") ?? "").trim() || null;
  const distanceRaw = Number(formData.get("distance_km"));
  const distanceKm = Number.isFinite(distanceRaw) && distanceRaw > 0 ? distanceRaw : null;
  const eventlyUrl = String(formData.get("evently_url") ?? "").trim() || null;

  if (!title) return err("Ponle nombre al evento.");
  if (!EVENT_TYPES.includes(eventType)) return err("Tipo de evento inválido.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return err("Elige la fecha.");
  if (meetUrl && !/^https?:\/\//.test(meetUrl)) return err("El link de la sesión debe partir con https://");
  if (eventlyUrl && !/^https?:\/\//.test(eventlyUrl)) return err("El link de Evently debe partir con https://");

  // Cada tipo guarda solo sus variables: así cambiar el tipo al editar no
  // deja campos colgando del tipo anterior.
  const online = eventType === "sesion_online";
  const isRun = eventType.startsWith("social_run");
  const row = {
    title,
    event_type: eventType,
    event_date: eventDate,
    event_time: eventTime,
    meeting_point: online ? null : meetingPoint,
    meet_url: online ? meetUrl : null,
    distance_km: isRun ? distanceKm : null,
    evently_url: isRun ? eventlyUrl : null,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await service.from("events").update(row).eq("id", id);
    if (error) return err("No pudimos guardar los cambios del evento.");
  } else {
    // Nace confirmado: si el staff lo crea aquí es porque va sí o sí.
    const { error } = await service
      .from("events")
      .insert({ ...row, status: "confirmado", owner_id: staff.id });
    if (error) return err("No pudimos crear el evento.");
  }
  revalidatePath("/miembros/calendario");
  revalidatePath("/miembros");
  return { ok: true };
}

/** Elimina un evento (los RSVP y la asistencia caen en cascada). */
export async function staffDeleteEvent(eventId: string): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch {
    return err("Solo el staff puede gestionar eventos.");
  }
  const service = createServiceClient();
  const { error } = await service.from("events").delete().eq("id", eventId);
  if (error) return err("No pudimos eliminar el evento.");
  revalidatePath("/miembros/calendario");
  revalidatePath("/miembros");
  return { ok: true };
}

// ─── Staff · retos ───────────────────────────────────────────────────────────

/** Crea o edita un reto desde la propia sección Retos. */
export async function staffSaveChallenge(formData: FormData): Promise<ActionResult> {
  let staff;
  try {
    staff = await requireStaff();
  } catch {
    return err("Solo el staff puede gestionar retos.");
  }
  const service = createServiceClient();

  const id = String(formData.get("id") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const period = String(formData.get("period") ?? "mes");
  const criterio = String(formData.get("criterio") ?? "cantidad");
  const goal = Math.max(1, Math.round(Number(formData.get("goal")) || 1));
  const points = Math.max(0, Math.round(Number(formData.get("points")) || 0));
  const medalId = String(formData.get("medal_id") ?? "") || null;
  // Lo que nombra el botón "+1" (solo aplica al autoreporte). Null = "entrenamiento".
  const unit = criterio === "cantidad" ? String(formData.get("unit") ?? "").trim().slice(0, 24) || null : null;

  if (!title) return err("Ponle título al reto.");
  if (!["mes", "semana", "hito", "general"].includes(period)) return err("Período inválido.");
  if (!["asistencia", "cantidad", "evidencia"].includes(criterio)) return err("Criterio inválido.");

  // Los retos del mes y micro-retos pertenecen a un mes (editable, así se
  // pueden dejar preparados los del próximo); hitos y generales no expiran.
  const monthInput = String(formData.get("month") ?? "");
  const monthly = period === "mes" || period === "semana";
  if (monthly && monthInput && !/^\d{4}-\d{2}$/.test(monthInput)) return err("Elige el mes del reto.");
  const month = monthly ? (monthInput || todayInChile().slice(0, 7)) + "-01" : null;
  const row = { title, description, period, criterio, goal, points, unit, medal_id: medalId, month };

  if (id) {
    const { error } = await service.from("challenges").update(row).eq("id", id);
    if (error) return err("No pudimos guardar los cambios del reto.");
  } else {
    const { error } = await service.from("challenges").insert({ ...row, created_by: staff.id });
    if (error) return err("No pudimos crear el reto.");
  }
  revalidatePath("/miembros/retos");
  return { ok: true };
}

/** Activa o desactiva un reto (desactivado deja de verse, sin borrar avances). */
export async function staffToggleChallenge(challengeId: string, active: boolean): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch {
    return err("Solo el staff puede gestionar retos.");
  }
  const service = createServiceClient();
  const { error } = await service.from("challenges").update({ active }).eq("id", challengeId);
  if (error) return err("No pudimos actualizar el reto.");
  revalidatePath("/miembros/retos");
  return { ok: true };
}

/** Elimina un reto y todo su progreso (cascada). */
export async function staffDeleteChallenge(challengeId: string): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch {
    return err("Solo el staff puede gestionar retos.");
  }
  const service = createServiceClient();
  const { error } = await service.from("challenges").delete().eq("id", challengeId);
  if (error) return err("No pudimos eliminar el reto.");
  revalidatePath("/miembros/retos");
  return { ok: true };
}

// ─── Staff · puntos ──────────────────────────────────────────────────────────

/** Guarda los pesos de puntos desde el apartado Ranking. */
export async function staffSavePoints(input: Record<string, number>): Promise<ActionResult> {
  try {
    await requireStaff();
  } catch {
    return err("Solo el staff puede editar los puntos.");
  }
  const service = createServiceClient();

  const clean: PointsWeights = { ...DEFAULT_POINTS };
  for (const key of Object.keys(DEFAULT_POINTS) as Array<keyof PointsWeights>) {
    const value = Number(input[key]);
    if (Number.isFinite(value) && value >= 0 && value <= 1000) clean[key] = Math.round(value);
  }

  const { error } = await service
    .from("community_config")
    .upsert({ key: "points", value: clean, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return err("No pudimos guardar los puntos.");
  revalidatePath("/miembros/ranking");
  return { ok: true };
}

// ─── Cuenta ──────────────────────────────────────────────────────────────────

/** Cambia el nombre con el que el miembro aparece en la comunidad. */
export async function updateDisplayName(name: string): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión expiró.");
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 2) return err("Ponle al menos 2 letras.");
  if (clean.length > 40) return err("Máximo 40 caracteres.");
  const service = createServiceClient();
  const { error } = await service.from("members").update({ display_name: clean }).eq("id", member.id);
  if (error) return err("No pudimos guardar tu nombre.");
  revalidatePath("/miembros", "layout");
  return { ok: true };
}

/** Marca el recorrido de bienvenida como visto (terminado o saltado). */
export async function completeOnboarding(): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return err("Tu sesión expiró.");
  const service = createServiceClient();
  await service.from("members").update({ onboarding_done_at: new Date().toISOString() }).eq("id", member.id);
  return { ok: true };
}
