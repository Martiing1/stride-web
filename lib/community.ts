import "server-only";
import { DISTINCTION } from "@/lib/community-shared";

import { createServiceClient } from "./supabase/server";
import { safeQuery } from "./safe-query";
import { todayInChile } from "./membership";

/**
 * Capa de datos de la COMUNIDAD de miembros (migración 012).
 *
 * Todo pasa por el service role (las páginas de /miembros nunca tocan las
 * tablas con la anon key), y todo usa safeQuery: si la migración 012 aún no
 * se ejecuta, el área de miembros carga igual con estados vacíos en vez de
 * reventar con un 500.
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type Channel = "general" | "logros" | "presentacion";

export interface FeedComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  /** Ruta de la foto del autor, ya lista para <img>. Null = iniciales. */
  author_photo: string | null;
  is_staff: boolean;
  is_mine: boolean;
  /** Distinción vigente del autor ("numero_uno"), si tiene. */
  author_badge?: "numero_uno" | null;
  body: string;
  created_at: string;
}

export interface FeedPost {
  id: string;
  channel: Channel;
  title: string | null;
  body: string;
  photo_urls: string[];
  video_url: string | null;
  is_pinned: boolean;
  author_name: string;
  /** Ruta de la foto del autor, ya lista para <img>. Null = iniciales. */
  author_photo: string | null;
  is_staff: boolean;
  is_mine: boolean;
  /** Distinción vigente del autor ("numero_uno"), si tiene. */
  author_badge?: "numero_uno" | null;
  event: { id: string; title: string; event_date: string; event_time: string | null; meeting_point: string | null; evently_url: string | null; spots_left: number | null; distance_km: number | null } | null;
  medal: { name: string; rarity: string; emoji: string } | null;
  like_count: number;
  liked_by_me: boolean;
  comments: FeedComment[];
  created_at: string;
  last_activity: string;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  sort_order: number;
  done_today: boolean;
}

export interface HabitsToday {
  habits: Habit[];
  all_done: boolean;
  streak: number;
  /** días completos de los últimos 14, para la grilla del perfil (índice 0 = hoy) */
  last14: boolean[];
}

export interface ChallengeView {
  id: string;
  title: string;
  description: string | null;
  period: "mes" | "semana" | "hito" | "general";
  criterio: "asistencia" | "cantidad" | "evidencia";
  goal: number;
  points: number;
  /** Qué se registra con el "+1" (avance, foto…). Null = "entrenamiento". */
  unit: string | null;
  medal: { name: string; rarity: string; emoji: string } | null;
  count: number;
  status: "en_curso" | "en_verificacion" | "cumplido" | "rechazado";
  completed_at: string | null;
}

export interface VitrinaMedal {
  id: string;
  name: string;
  rarity: "bronce" | "plata" | "oro";
  emoji: string;
  kind: string;
  is_physical: boolean;
  status: "otorgada" | "en_revision" | "rechazada";
  photo_url: string | null;
  note: string | null;
  awarded_at: string;
}

export interface RankingRow {
  member_id: string;
  full_name: string;
  points: number;
  is_me: boolean;
}

export interface MemberEvent {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  event_time: string | null;
  meeting_point: string | null;
  meeting_point_map_url: string | null;
  distance_km: number | null;
  evently_url: string | null;
  meet_url: string | null;
  capacity: number | null;
  spots_left: number | null;
  is_online: boolean;
  my_rsvp: "voy" | "no_voy" | null;
}

export interface CourseView {
  id: string;
  title: string;
  subtitle: string | null;
  emoji: string;
  category: "plan" | "etapa" | "biblioteca";
  opens_month: string | null;
  locked: boolean;
  lesson_count: number;
  done_count: number;
}

export interface MemberNotification {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  href: string | null;
  read: boolean;
  created_at: string;
}

import { DEFAULT_POINTS, memberDisplayName, type PointsWeights } from "./community-shared";

export { DEFAULT_POINTS, MAX_HABITS, memberDisplayName, type PointsWeights } from "./community-shared";

// ─── Config ──────────────────────────────────────────────────────────────────

export async function getPointsWeights(): Promise<PointsWeights> {
  const service = createServiceClient();
  const row = await safeQuery(
    () => service.from("community_config").select("value").eq("key", "points").maybeSingle(),
    null as { value: Partial<PointsWeights> } | null
  );
  return { ...DEFAULT_POINTS, ...(row?.value ?? {}) };
}

// ─── Puntos ──────────────────────────────────────────────────────────────────

/**
 * Suma puntos al ledger. `refId` activa el candado anti-duplicados (índice
 * único parcial): la misma causa jamás paga dos veces.
 */
export async function addPoints(
  memberId: string,
  points: number,
  source: string,
  reason: string,
  refId?: string
): Promise<void> {
  if (points === 0) return;
  const service = createServiceClient();
  const { error } = await service.from("points_ledger").insert({
    member_id: memberId,
    points,
    source,
    reason,
    ref_id: refId ?? null,
  });
  // 23505 = ya se pagó esta causa; cualquier otro error se ignora a propósito:
  // los puntos nunca deben botar la acción principal (post, hábito, etc.).
  if (error && !`${error.code}`.includes("23505")) {
    console.error("[community] addPoints", error.message);
  }
}

/** Límite [desde, hasta) del mes actual en Chile, como timestamps ISO en UTC. */
function currentMonthBoundsChile(): { from: string; to: string } {
  const today = todayInChile(); // YYYY-MM-DD en Chile
  const [y, m] = today.split("-").map(Number);
  // Chile va entre UTC-3 y UTC-4; usar 04:00Z cubre el inicio de día chileno.
  const from = new Date(Date.UTC(y, m - 1, 1, 4)).toISOString();
  const to = new Date(Date.UTC(y, m, 1, 4)).toISOString();
  return { from, to };
}

export async function getMonthlyRanking(myMemberId: string): Promise<{ rows: RankingRow[]; mine: number }> {
  const service = createServiceClient();
  const { from, to } = currentMonthBoundsChile();
  const ledger = await safeQuery(
    () =>
      service
        .from("points_ledger")
        .select("member_id, points, members!inner(full_name, display_name)")
        .gte("created_at", from)
        .lt("created_at", to)
        .returns<Array<{ member_id: string; points: number; members: { full_name: string; display_name: string | null } }>>(),
    [] as Array<{ member_id: string; points: number; members: { full_name: string; display_name: string | null } }>
  );

  const byMember = new Map<string, RankingRow>();
  for (const row of ledger) {
    const current = byMember.get(row.member_id);
    if (current) current.points += row.points;
    else
      byMember.set(row.member_id, {
        member_id: row.member_id,
        full_name: row.members ? memberDisplayName(row.members) : "Miembro",
        points: row.points,
        is_me: row.member_id === myMemberId,
      });
  }
  const rows = Array.from(byMember.values()).sort((a, b) => b.points - a.points);
  const mine = rows.find((r) => r.is_me)?.points ?? 0;
  return { rows, mine };
}

// ─── Blog ────────────────────────────────────────────────────────────────────

interface RawPost {
  id: string;
  channel: Channel;
  title: string | null;
  body: string;
  photo_paths: string[];
  video_url: string | null;
  is_pinned: boolean;
  author_member_id: string | null;
  author_team_member_id: string | null;
  member_medal_id: string | null;
  event_id: string | null;
  created_at: string;
  members: { full_name: string; display_name: string | null; photo_path: string | null } | null;
  team_members: { full_name: string; nickname: string | null; photo_path: string | null } | null;
}

/** URL de la foto de perfil de un autor del feed, o null si no tiene. */
function authorPhotoUrl(
  member: { photo_path: string | null } | null,
  staff: { photo_path: string | null } | null
): string | null {
  if (member?.photo_path) return `/api/miembros/foto?bucket=member-photos&path=${encodeURIComponent(member.photo_path)}`;
  if (staff?.photo_path) return `/api/miembros/foto?bucket=team-photos&path=${encodeURIComponent(staff.photo_path)}`;
  return null;
}

export async function getFeed(
  myMemberId: string | null,
  channel?: Channel | "all",
  myTeamMemberId: string | null = null
): Promise<FeedPost[]> {
  const service = createServiceClient();

  let query = service
    .from("community_posts")
    .select(
      "id, channel, title, body, photo_paths, video_url, is_pinned, author_member_id, author_team_member_id, member_medal_id, event_id, created_at, members:author_member_id(full_name, display_name, photo_path), team_members:author_team_member_id(full_name, nickname, photo_path)"
    )
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);
  if (channel && channel !== "all") query = query.eq("channel", channel);

  const posts = await safeQuery(() => query.returns<RawPost[]>(), [] as RawPost[]);
  if (posts.length === 0) return [];

  const ids = posts.map((p) => p.id);
  const [likes, comments, medals, events, distinguidos] = await Promise.all([
    safeQuery(
      () => service.from("community_likes").select("post_id, member_id, team_member_id").in("post_id", ids),
      [] as Array<{ post_id: string; member_id: string | null; team_member_id: string | null }>
    ),
    (async () => {
      type RawComment = { id: string; post_id: string; parent_id: string | null; body: string; created_at: string; author_member_id: string | null; members: { full_name: string; display_name: string | null; photo_path: string | null } | null; team_members: { full_name: string; nickname: string | null; photo_path: string | null } | null };
      try {
        const withParent = await service
          .from("community_comments")
          .select("id, post_id, parent_id, body, created_at, author_member_id, members:author_member_id(full_name, display_name, photo_path), team_members:author_team_member_id(full_name, nickname, photo_path)")
          .in("post_id", ids)
          .order("created_at")
          .returns<RawComment[]>();
        if (!withParent.error) return withParent.data ?? [];
        // Migración 013 pendiente: reintenta sin parent_id (hilos planos).
        const legacy = await service
          .from("community_comments")
          .select("id, post_id, body, created_at, author_member_id, members:author_member_id(full_name, display_name, photo_path), team_members:author_team_member_id(full_name, nickname, photo_path)")
          .in("post_id", ids)
          .order("created_at")
          .returns<Array<Omit<RawComment, "parent_id">>>();
        return (legacy.data ?? []).map((c) => ({ ...c, parent_id: null as string | null }));
      } catch {
        return [] as RawComment[];
      }
    })(),
    (async () => {
      const medalIds = posts.map((p) => p.member_medal_id).filter(Boolean) as string[];
      if (medalIds.length === 0) return [] as Array<{ id: string; title_override: string | null; medals: { name: string; rarity: string; emoji: string } | null }>;
      return safeQuery(
        () =>
          service
            .from("member_medals")
            .select("id, title_override, medals:medal_id(name, rarity, emoji)")
            .in("id", medalIds)
            .returns<Array<{ id: string; title_override: string | null; medals: { name: string; rarity: string; emoji: string } | null }>>(),
        [] as Array<{ id: string; title_override: string | null; medals: { name: string; rarity: string; emoji: string } | null }>
      );
    })(),
    (async () => {
      const eventIds = posts.map((p) => p.event_id).filter(Boolean) as string[];
      if (eventIds.length === 0) return [] as Array<{ id: string; title: string; event_date: string; event_time: string | null; meeting_point: string | null; evently_url: string | null; spots_left: number | null; distance_km: number | null }>;
      return safeQuery(
        () => service.from("events").select("id, title, event_date, event_time, meeting_point, evently_url, spots_left, distance_km").in("id", eventIds),
        [] as Array<{ id: string; title: string; event_date: string; event_time: string | null; meeting_point: string | null; evently_url: string | null; spots_left: number | null; distance_km: number | null }>
      );
    })(),
    getDistinctions().then((rows) => new Set(rows.map((r) => r.member_id))),
  ]);

  const likesByPost = new Map<string, { count: number; mine: boolean }>();
  for (const like of likes) {
    const entry = likesByPost.get(like.post_id) ?? { count: 0, mine: false };
    entry.count += 1;
    if ((myMemberId && like.member_id === myMemberId) || (myTeamMemberId && like.team_member_id === myTeamMemberId))
      entry.mine = true;
    likesByPost.set(like.post_id, entry);
  }
  const commentsByPost = new Map<string, FeedComment[]>();
  for (const c of comments) {
    const list = commentsByPost.get(c.post_id) ?? [];
    list.push({
      id: c.id,
      post_id: c.post_id,
      parent_id: c.parent_id ?? null,
      body: c.body,
      created_at: c.created_at,
      is_staff: !c.author_member_id,
      is_mine: c.author_member_id === myMemberId,
      author_badge: c.author_member_id && distinguidos.has(c.author_member_id) ? "numero_uno" : null,
      author_name: (c.members ? memberDisplayName(c.members) : null) ?? c.team_members?.nickname ?? c.team_members?.full_name ?? "STRIDE",
      author_photo: authorPhotoUrl(c.members, c.team_members),
    });
    commentsByPost.set(c.post_id, list);
  }

  return posts.map((p) => {
    const like = likesByPost.get(p.id) ?? { count: 0, mine: false };
    const postComments = commentsByPost.get(p.id) ?? [];
    const medalRow = medals.find((m) => m.id === p.member_medal_id);
    const eventRow = events.find((e) => e.id === p.event_id) ?? null;
    return {
      id: p.id,
      channel: p.channel,
      title: p.title,
      body: p.body,
      photo_urls: (p.photo_paths ?? []).map(
        (path) => `/api/miembros/foto?bucket=post-photos&path=${encodeURIComponent(path)}`
      ),
      video_url: p.video_url,
      is_pinned: p.is_pinned,
      author_name: p.author_member_id ? p.members ? memberDisplayName(p.members) : "Miembro" : "STRIDE",
      author_photo: authorPhotoUrl(p.members, p.team_members),
      is_staff: !p.author_member_id,
      is_mine: Boolean(p.author_member_id && p.author_member_id === myMemberId),
      author_badge: p.author_member_id && distinguidos.has(p.author_member_id) ? "numero_uno" : null,
      event: eventRow,
      medal: medalRow
        ? medalRow.medals ?? { name: medalRow.title_override ?? "Medalla", rarity: "oro", emoji: "🏅" }
        : null,
      like_count: like.count,
      liked_by_me: like.mine,
      comments: postComments,
      created_at: p.created_at,
      last_activity: postComments.length ? postComments[postComments.length - 1].created_at : p.created_at,
    };
  });
}

// ─── Distinciones ────────────────────────────────────────────────────────────

export interface Distinction {
  member_id: string;
  name: string;
  photo: string | null;
  rank: number;
  /** Comentarios hechos en el mes medido. */
  score: number;
}

/** Mes en que SE LUCE la insignia (YYYY-MM-01) y límites ISO del mes medido (el anterior). */
function distinctionWindowChile(): { showMonth: string; from: string; to: string } {
  const [y, m] = todayInChile().split("-").map(Number);
  const showMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  // Date.UTC resuelve solo el cambio de año (m-2 = -1 → diciembre anterior).
  const from = new Date(Date.UTC(y, m - 2, 1, 4)).toISOString();
  const to = new Date(Date.UTC(y, m - 1, 1, 4)).toISOString();
  return { showMonth, from, to };
}

/**
 * Quién sumó más puntos entre `from` y `to`: el Nº1 del ranking de ese mes.
 * Solo lectura. Si hay empate en el corte entran todos los empatados: nadie
 * queda afuera por sorteo.
 */
export async function computeTopScorers(
  from: string,
  to: string
): Promise<Array<{ member_id: string; score: number; rank: number }>> {
  const service = createServiceClient();
  const rows = await safeQuery(
    () =>
      service
        .from("points_ledger")
        .select("member_id, points")
        .gte("created_at", from)
        .lt("created_at", to)
        .returns<Array<{ member_id: string; points: number }>>(),
    [] as Array<{ member_id: string; points: number }>
  );
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.member_id, (totals.get(r.member_id) ?? 0) + r.points);

  const sorted = [...totals.entries()]
    .filter(([, n]) => n >= DISTINCTION.minPoints)
    .sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return [];

  const cutoff = sorted[Math.min(DISTINCTION.top, sorted.length) - 1][1];
  let rank = 0;
  let prev = -1;
  return sorted
    .filter(([, n]) => n >= cutoff)
    .map(([member_id, score]) => {
      if (score !== prev) {
        rank += 1;
        prev = score;
      }
      return { member_id, score, rank };
    });
}

/**
 * Distinciones vigentes. La primera lectura de cada mes calcula quién ganó el
 * ranking del mes anterior, lo guarda en community_distinctions y le
 * avisa por la campana; las lecturas siguientes solo leen. El
 * unique de la tabla evita duplicados si dos visitas llegan a la vez, y como
 * el upsert devuelve solo las filas nuevas, el aviso sale una vez.
 */
export async function getDistinctions(): Promise<Distinction[]> {
  const service = createServiceClient();
  const { showMonth, from, to } = distinctionWindowChile();
  type Row = {
    member_id: string;
    rank: number;
    score: number;
    members: { full_name: string; display_name: string | null; photo_path: string | null } | null;
  };
  const read = () =>
    safeQuery(
      () =>
        service
          .from("community_distinctions")
          .select("member_id, rank, score, members:member_id(full_name, display_name, photo_path)")
          .eq("month", showMonth)
          .eq("kind", DISTINCTION.kind)
          .order("rank")
          .order("score", { ascending: false })
          .returns<Row[]>(),
      [] as Row[]
    );

  let rows = await read();
  if (rows.length === 0) {
    const top = await computeTopScorers(from, to);
    if (top.length > 0) {
      const { data: inserted } = await service
        .from("community_distinctions")
        .upsert(
          top.map((t) => ({ month: showMonth, kind: DISTINCTION.kind, member_id: t.member_id, rank: t.rank, score: t.score })),
          { onConflict: "month,kind,member_id", ignoreDuplicates: true }
        )
        .select("member_id, score");
      // La medalla del Nº1 se entrega sola: una por mes ganado, porque solo
      // se llega acá con las filas recién insertadas.
      const { data: medal } = await service
        .from("medals")
        .select("id")
        .eq("name", DISTINCTION.medalName)
        .eq("active", true)
        .maybeSingle();

      for (const row of inserted ?? []) {
        let medalGiven = false;
        if (medal?.id) {
          const { error } = await service
            .from("member_medals")
            .insert({ member_id: row.member_id, medal_id: medal.id, status: "otorgada" });
          if (error) console.error("[community] medalla Nº1", error.message);
          else medalGiven = true;
        }
        await notify(row.member_id, {
          title: `Eres el ${DISTINCTION.label} 👑`,
          body: `Ganaste el ranking del mes pasado con ${row.score} puntos.${
            medalGiven ? " Tu medalla ya está en la vitrina y" : ""
          } este mes tu nombre lleva la insignia.`,
          kind: "distincion",
          href: medalGiven ? "/miembros/perfil" : "/miembros/ranking",
        });
      }
      rows = await read();
    }
  }

  return rows.map((r) => ({
    member_id: r.member_id,
    rank: r.rank,
    score: r.score,
    name: r.members ? memberDisplayName(r.members) : "Miembro",
    photo: r.members?.photo_path
      ? `/api/miembros/foto?bucket=member-photos&path=${encodeURIComponent(r.members.photo_path)}`
      : null,
  }));
}

// ─── Hábitos ─────────────────────────────────────────────────────────────────

export async function getHabitsToday(memberId: string): Promise<HabitsToday> {
  const service = createServiceClient();
  const today = todayInChile();

  const habits = await safeQuery(
    () =>
      service
        .from("habits")
        .select("id, name, emoji, color, sort_order")
        .eq("member_id", memberId)
        .eq("active", true)
        .order("sort_order"),
    [] as Array<{ id: string; name: string; emoji: string; color: string; sort_order: number }>
  );

  // Últimos 130 días de logs para racha + grilla.
  const since = new Date();
  since.setDate(since.getDate() - 130);
  const logs = await safeQuery(
    () =>
      service
        .from("habit_logs")
        .select("habit_id, log_date")
        .eq("member_id", memberId)
        .gte("log_date", since.toISOString().slice(0, 10)),
    [] as Array<{ habit_id: string; log_date: string }>
  );

  const activeIds = new Set(habits.map((h) => h.id));
  const byDate = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!activeIds.has(log.habit_id)) continue;
    const set = byDate.get(log.log_date) ?? new Set<string>();
    set.add(log.habit_id);
    byDate.set(log.log_date, set);
  }
  const isComplete = (date: string) =>
    habits.length > 0 && (byDate.get(date)?.size ?? 0) >= habits.length;

  // Pausas aprobadas: esos días no cortan la racha.
  const pauses = await safeQuery(
    () =>
      service
        .from("pause_requests")
        .select("start_date, end_date")
        .eq("member_id", memberId)
        .eq("status", "aprobada"),
    [] as Array<{ start_date: string | null; end_date: string | null }>
  );
  const isPaused = (date: string) =>
    pauses.some((p) => (!p.start_date || p.start_date <= date) && (!p.end_date || date <= p.end_date));

  // Racha: desde hoy (o ayer si hoy aún no completa) hacia atrás.
  const dateStr = (offset: number) => {
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - offset);
    return dt.toISOString().slice(0, 10);
  };
  let streak = 0;
  let offset = isComplete(today) ? 0 : 1;
  for (; offset < 130; offset++) {
    const date = dateStr(offset);
    if (isComplete(date)) streak++;
    else if (isPaused(date)) continue; // día protegido
    else break;
  }

  const last14: boolean[] = [];
  for (let i = 0; i < 14; i++) last14.push(isComplete(dateStr(i)));

  const todaySet = byDate.get(today) ?? new Set<string>();
  return {
    habits: habits.map((h) => ({ ...h, done_today: todaySet.has(h.id) })),
    all_done: habits.length > 0 && todaySet.size >= habits.length,
    streak,
    last14,
  };
}

// ─── Asistencia ──────────────────────────────────────────────────────────────

export async function getAttendanceStats(memberId: string): Promise<{ total: number; weekStreak: number }> {
  const service = createServiceClient();
  const rows = await safeQuery(
    () =>
      service
        .from("event_attendance")
        .select("event_id, events!inner(event_date, event_type)")
        .eq("member_id", memberId)
        .returns<Array<{ event_id: string; events: { event_date: string; event_type: string } }>>(),
    [] as Array<{ event_id: string; events: { event_date: string; event_type: string } }>
  );
  const runDates = rows
    .filter((r) => r.events.event_type.startsWith("social_run"))
    .map((r) => r.events.event_date)
    .sort()
    .reverse();

  // Racha en semanas: semanas consecutivas (hacia atrás desde la última) con
  // al menos un social run asistido.
  const weekOf = (date: string) => {
    const d = new Date(date + "T12:00:00Z");
    const day = (d.getUTCDay() + 6) % 7; // lunes = 0
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  };
  const weeks = Array.from(new Set(runDates.map(weekOf))).sort().reverse();
  let weekStreak = 0;
  if (weeks.length > 0) {
    const thisWeek = weekOf(todayInChile());
    let cursor = weeks[0] === thisWeek || weeks[0] === weekOf(addDays(thisWeek, -7)) ? weeks[0] : null;
    for (const w of weeks) {
      if (cursor === null) break;
      if (w === cursor) {
        weekStreak++;
        cursor = weekOf(addDays(cursor, -7));
      } else break;
    }
  }
  return { total: runDates.length, weekStreak };
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Retos ───────────────────────────────────────────────────────────────────

export async function getChallenges(memberId: string): Promise<ChallengeView[]> {
  const service = createServiceClient();
  const monthStart = todayInChile().slice(0, 7) + "-01";

  const challenges = await safeQuery(
    () =>
      service
        .from("challenges")
        .select("id, title, description, period, criterio, goal, points, unit, month, medals:medal_id(name, rarity, emoji)")
        .eq("active", true)
        .or(`month.eq.${monthStart},month.is.null`)
        .order("period")
        .returns<Array<{ id: string; title: string; description: string | null; period: ChallengeView["period"]; criterio: ChallengeView["criterio"]; goal: number; points: number; unit: string | null; month: string | null; medals: { name: string; rarity: string; emoji: string } | null }>>(),
    [] as Array<{ id: string; title: string; description: string | null; period: ChallengeView["period"]; criterio: ChallengeView["criterio"]; goal: number; points: number; unit: string | null; month: string | null; medals: { name: string; rarity: string; emoji: string } | null }>
  );
  if (challenges.length === 0) return [];

  const progress = await safeQuery(
    () =>
      service
        .from("challenge_progress")
        .select("challenge_id, count, status, completed_at")
        .eq("member_id", memberId)
        .in("challenge_id", challenges.map((c) => c.id)),
    [] as Array<{ challenge_id: string; count: number; status: ChallengeView["status"]; completed_at: string | null }>
  );

  // Retos de asistencia: solo Social Runs del mes (las sesiones online dan
  // puntos pero no avanzan el reto de asistencia).
  const { from, to } = currentMonthBoundsChile();
  const attendance = await safeQuery(
    () =>
      service
        .from("event_attendance")
        .select("id, events!inner(event_date, event_type)")
        .eq("member_id", memberId)
        .like("events.event_type", "social_run%")
        .gte("created_at", from)
        .lt("created_at", to)
        .returns<Array<{ id: string }>>(),
    [] as Array<{ id: string }>
  );

  return challenges.map((c) => {
    const p = progress.find((x) => x.challenge_id === c.id);
    const count = c.criterio === "asistencia" ? attendance.length : p?.count ?? 0;
    const status: ChallengeView["status"] =
      p?.status ?? (c.criterio === "asistencia" && count >= c.goal ? "cumplido" : "en_curso");
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      period: c.period,
      criterio: c.criterio,
      goal: c.goal,
      points: c.points,
      unit: c.unit,
      medal: c.medals,
      count: Math.min(count, c.goal),
      status,
      completed_at: p?.completed_at ?? null,
    };
  });
}

// ─── Medallas ────────────────────────────────────────────────────────────────

export async function getVitrina(memberId: string): Promise<VitrinaMedal[]> {
  const service = createServiceClient();
  type RawMedal = { id: string; title_override: string | null; photo_path: string | null; is_physical: boolean; status: VitrinaMedal["status"]; note: string | null; awarded_at: string; medals: { name: string; rarity: VitrinaMedal["rarity"]; emoji: string; kind: string } | null };
  let rows: RawMedal[] = [];
  try {
    const withNote = await service
      .from("member_medals")
      .select("id, title_override, photo_path, is_physical, status, note, awarded_at, medals:medal_id(name, rarity, emoji, kind)")
      .eq("member_id", memberId)
      .neq("status", "rechazada")
      .order("awarded_at", { ascending: false })
      .returns<RawMedal[]>();
    if (!withNote.error) {
      rows = withNote.data ?? [];
    } else {
      // Migración 013 pendiente: reintenta sin la columna note.
      const legacy = await service
        .from("member_medals")
        .select("id, title_override, photo_path, is_physical, status, awarded_at, medals:medal_id(name, rarity, emoji, kind)")
        .eq("member_id", memberId)
        .neq("status", "rechazada")
        .order("awarded_at", { ascending: false })
        .returns<Array<Omit<RawMedal, "note">>>();
      rows = (legacy.data ?? []).map((r) => ({ ...r, note: null }));
    }
  } catch {
    rows = [];
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.medals?.name ?? r.title_override ?? "Medalla",
    rarity: r.medals?.rarity ?? "oro",
    emoji: r.medals?.emoji ?? "🏅",
    kind: r.medals?.kind ?? (r.is_physical ? "fisica" : "reto"),
    is_physical: r.is_physical,
    status: r.status,
    photo_url: r.photo_path
      ? `/api/miembros/foto?bucket=medal-photos&path=${encodeURIComponent(r.photo_path)}`
      : null,
    note: r.note ?? null,
    awarded_at: r.awarded_at,
  }));
}

// ─── Eventos ─────────────────────────────────────────────────────────────────

export async function getMemberEvents(memberId: string | null): Promise<MemberEvent[]> {
  const service = createServiceClient();
  const events = await safeQuery(
    () =>
      service
        .from("events")
        .select("id, title, event_type, event_date, event_time, meeting_point, meeting_point_map_url, distance_km, evently_url, meet_url, capacity, spots_left")
        .in("status", ["confirmado", "encuesta_abierta"])
        .gte("event_date", todayInChile())
        .order("event_date")
        .limit(20),
    [] as Array<Omit<MemberEvent, "is_online" | "my_rsvp">>
  );
  if (events.length === 0) return [];

  const rsvps = memberId
    ? await safeQuery(
        () =>
          service
            .from("event_rsvps")
            .select("event_id, response")
            .eq("member_id", memberId)
            .in("event_id", events.map((e) => e.id)),
        [] as Array<{ event_id: string; response: "voy" | "no_voy" }>
      )
    : [];

  return events.map((e) => ({
    ...e,
    is_online: e.event_type === "sesion_online" || Boolean(e.meet_url),
    my_rsvp: rsvps.find((r) => r.event_id === e.id)?.response ?? null,
  }));
}

// ─── Classroom ───────────────────────────────────────────────────────────────

export async function getCourses(memberId: string): Promise<CourseView[]> {
  const service = createServiceClient();
  const monthStart = todayInChile().slice(0, 7) + "-01";

  const [courses, lessons, progress] = await Promise.all([
    safeQuery(
      () =>
        service
          .from("courses")
          .select("id, title, subtitle, emoji, category, opens_month, sort_order")
          .eq("active", true)
          .order("sort_order"),
      [] as Array<{ id: string; title: string; subtitle: string | null; emoji: string; category: CourseView["category"]; opens_month: string | null; sort_order: number }>
    ),
    safeQuery(
      () => service.from("course_lessons").select("id, course_id"),
      [] as Array<{ id: string; course_id: string }>
    ),
    safeQuery(
      () => service.from("lesson_progress").select("lesson_id").eq("member_id", memberId),
      [] as Array<{ lesson_id: string }>
    ),
  ]);

  const doneLessons = new Set(progress.map((p) => p.lesson_id));
  return courses.map((c) => {
    const courseLessons = lessons.filter((l) => l.course_id === c.id);
    return {
      ...c,
      locked: c.category === "etapa" && Boolean(c.opens_month) && c.opens_month! > monthStart,
      lesson_count: courseLessons.length,
      done_count: courseLessons.filter((l) => doneLessons.has(l.id)).length,
    };
  });
}

// ─── Notificaciones ──────────────────────────────────────────────────────────

export async function getNotifications(memberId: string): Promise<{ items: MemberNotification[]; unread: number }> {
  const service = createServiceClient();
  const items = await safeQuery(
    () =>
      service
        .from("notifications")
        .select("id, title, body, kind, href, read, created_at")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(15),
    [] as MemberNotification[]
  );
  return { items, unread: items.filter((n) => !n.read).length };
}

export async function notify(
  memberId: string,
  data: { title: string; body?: string; kind?: string; href?: string }
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("notifications").insert({
    member_id: memberId,
    title: data.title,
    body: data.body ?? null,
    kind: data.kind ?? "general",
    href: data.href ?? null,
  });
  if (error) console.error("[community] notify", error.message);
}

// ─── Vistas de admin (staff dentro de /miembros) ─────────────────────────────

export interface AdminChallengeRow {
  id: string;
  title: string;
  description: string | null;
  period: "mes" | "semana" | "hito" | "general";
  criterio: "asistencia" | "cantidad" | "evidencia";
  goal: number;
  points: number;
  unit: string | null;
  medal_id: string | null;
  month: string | null;
  active: boolean;
}

/** Todos los retos (activos e inactivos) para el panel de gestión en Retos. */
export async function getChallengesAdmin(): Promise<AdminChallengeRow[]> {
  const service = createServiceClient();
  return safeQuery(
    () =>
      service
        .from("challenges")
        .select("id, title, description, period, criterio, goal, points, unit, medal_id, month, active")
        .order("active", { ascending: false })
        .order("period")
        .order("created_at", { ascending: false })
        .returns<AdminChallengeRow[]>(),
    [] as AdminChallengeRow[]
  );
}

export interface MedalOption {
  id: string;
  name: string;
  emoji: string;
  rarity: string;
}

/** Medallas activas para asociar a un reto. */
export async function getMedalOptions(): Promise<MedalOption[]> {
  const service = createServiceClient();
  return safeQuery(
    () =>
      service
        .from("medals")
        .select("id, name, emoji, rarity")
        .eq("active", true)
        .order("name")
        .returns<MedalOption[]>(),
    [] as MedalOption[]
  );
}
