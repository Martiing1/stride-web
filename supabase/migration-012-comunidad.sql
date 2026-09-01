-- ============================================================================
-- STRIDE — Migración 012: comunidad de miembros (reemplazo de Skool)
-- Ejecutar sobre schema.sql + migraciones 002–011. 100% ADITIVA: no modifica
-- ni borra datos existentes. Crea el área de miembros: blog, hábitos, retos,
-- medallas, puntos/ranking, RSVP + asistencia (Evently), notificaciones,
-- classroom y pausas.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Helper de autorización: ¿la sesión actual es un miembro STRIDE ONE?
--    (equivalente comunitario de is_team(); un miembro pausado sigue pudiendo
--    entrar a mirar, la vigencia se controla en la app para acciones de valor)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from members
    where auth_user_id = auth.uid()
  );
$$;

-- id del miembro de la sesión (null si no es miembro)
create or replace function current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from members where auth_user_id = auth.uid() limit 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CONFIGURACIÓN DE LA COMUNIDAD (pesos de puntos, flags)
--    Tabla propia para no depender de la forma de app_settings.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists community_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into community_config (key, value) values
  ('points', jsonb_build_object(
    'post', 5,
    'comment', 2,
    'like_received', 1,
    'social_run', 20,
    'sesion_online', 10,
    'habitos_dia', 3,
    'reto_mes', 50,
    'micro_reto', 15,
    'hito', 25,
    'reto_general', 30
  )),
  -- Niveles: existen en el modelo pero Martín pidió NO mostrarlos en la UI.
  ('levels', jsonb_build_object('visible', false, 'thresholds', jsonb_build_array(0, 30, 80, 160, 280, 450, 700, 1000, 1400))),
  ('habits', jsonb_build_object('max_per_member', 4))
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BLOG COMUNITARIO
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  -- Autor: un miembro O el staff (post institucional, con video permitido).
  author_member_id uuid references members (id) on delete set null,
  author_team_member_id uuid references team_members (id) on delete set null,
  channel text not null default 'general'
    check (channel in ('general', 'logros', 'presentacion')),
  title text,
  body text not null,
  photo_paths text[] not null default '{}',        -- bucket post-photos
  video_url text,                                   -- solo staff (YouTube embed)
  is_pinned boolean not null default false,         -- solo staff
  -- Si el post nace de una medalla ganada ("publicar en el blog")
  member_medal_id uuid,
  event_id uuid references events (id) on delete set null, -- comunicado de Social Run
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (author_member_id is not null or author_team_member_id is not null)
);

create index if not exists idx_cposts_created on community_posts (created_at desc);
create index if not exists idx_cposts_pinned on community_posts (is_pinned) where is_pinned;
create index if not exists idx_cposts_channel on community_posts (channel, created_at desc);

create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts (id) on delete cascade,
  author_member_id uuid references members (id) on delete set null,
  author_team_member_id uuid references team_members (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  check (author_member_id is not null or author_team_member_id is not null)
);
create index if not exists idx_ccomments_post on community_comments (post_id, created_at);

create table if not exists community_likes (
  post_id uuid not null references community_posts (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HÁBITOS (privados: solo el propio miembro los ve; máx 4 por miembro,
--    tope que la app respeta leyendo community_config)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  name text not null,
  emoji text not null default '💧',
  color text not null default '#00E5FF',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_habits_member on habits (member_id) where active;

create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index if not exists idx_hlogs_member_date on habit_logs (member_id, log_date desc);

-- Racha protegida: pausas aprobadas no cortan la racha.
create table if not exists pause_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  note text not null,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'aprobada', 'rechazada', 'finalizada')),
  start_date date,
  end_date date,
  reviewed_by uuid references team_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pauses_member on pause_requests (member_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MEDALLAS
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists medals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  rarity text not null default 'bronce' check (rarity in ('bronce', 'plata', 'oro')),
  emoji text not null default '🏅',
  kind text not null default 'reto' check (kind in ('reto', 'hito', 'especial', 'ranking')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists member_medals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  -- Medalla de catálogo… o física subida por el miembro (medal_id null)
  medal_id uuid references medals (id) on delete set null,
  title_override text,                 -- nombre de la medalla física ("10K Viña 2026")
  photo_path text,                     -- bucket medal-photos (físicas)
  is_physical boolean not null default false,
  status text not null default 'otorgada'
    check (status in ('otorgada', 'en_revision', 'rechazada')),
  pinned boolean not null default false,           -- destacada en el perfil
  source_challenge_id uuid,
  awarded_by uuid references team_members (id) on delete set null,
  awarded_at timestamptz not null default now(),
  check (medal_id is not null or title_override is not null)
);
create index if not exists idx_mmedals_member on member_medals (member_id, awarded_at desc);

alter table community_posts
  drop constraint if exists community_posts_member_medal_fk;
alter table community_posts
  add constraint community_posts_member_medal_fk
  foreign key (member_medal_id) references member_medals (id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RETOS
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  -- mes = reto del mes (etapa) | semana = micro-reto | hito = permanente | general
  period text not null default 'mes' check (period in ('mes', 'semana', 'hito', 'general')),
  -- asistencia = se cumple con event_attendance | cantidad = autoreporte +1
  -- evidencia = sube foto/video y el staff verifica
  criterio text not null default 'cantidad' check (criterio in ('asistencia', 'cantidad', 'evidencia')),
  goal integer not null default 1 check (goal > 0),
  points integer not null default 0,
  medal_id uuid references medals (id) on delete set null,
  -- Mes al que pertenece (primer día). Null en hitos/generales.
  month date,
  active boolean not null default true,
  created_by uuid references team_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_challenges_active on challenges (active, period, month);

create table if not exists challenge_progress (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  count integer not null default 0 check (count >= 0),
  evidence_path text,                  -- bucket evidence
  status text not null default 'en_curso'
    check (status in ('en_curso', 'en_verificacion', 'cumplido', 'rechazado')),
  completed_at timestamptz,
  verified_by uuid references team_members (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (challenge_id, member_id)
);
create index if not exists idx_cprogress_member on challenge_progress (member_id);
create index if not exists idx_cprogress_review on challenge_progress (status) where status = 'en_verificacion';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PUNTOS (ledger → el ranking mensual se calcula sumando por mes de Chile)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists points_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  points integer not null,
  reason text not null,
  source text not null default 'ajuste'
    check (source in ('post', 'comment', 'like_received', 'social_run', 'sesion_online',
                      'habitos_dia', 'reto_mes', 'micro_reto', 'reto_general', 'hito',
                      'ranking_mes', 'ajuste')),
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_points_member_date on points_ledger (member_id, created_at desc);
create index if not exists idx_points_date on points_ledger (created_at desc);

-- Evita puntos duplicados por la misma causa (ej: mismos hábitos del día dos veces)
create unique index if not exists idx_points_dedupe
  on points_ledger (member_id, source, ref_id) where ref_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. EVENTOS: sesiones online + RSVP + asistencia importada de Evently
-- ─────────────────────────────────────────────────────────────────────────────
-- Nuevo tipo de evento y link de Meet (aditivo: recrea el check ampliado)
alter table events add column if not exists meet_url text;
alter table events drop constraint if exists events_event_type_check;
alter table events add constraint events_event_type_check
  check (event_type in ('social_run', 'social_run_cafeteria', 'social_run_sunset',
                        'marca', 'retiro', 'race_trip', 'sesion_online', 'otro'));

create table if not exists event_rsvps (
  event_id uuid not null references events (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  response text not null check (response in ('voy', 'no_voy')),
  created_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

create table if not exists event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  member_id uuid references members (id) on delete set null,
  -- Datos crudos del CSV de Evently, por si el email no calza con ningún miembro
  attendee_name text,
  attendee_email text,
  source text not null default 'evently_csv' check (source in ('evently_csv', 'manual')),
  imported_by uuid references team_members (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_attendance_member
  on event_attendance (event_id, member_id) where member_id is not null;
create index if not exists idx_attendance_event on event_attendance (event_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. NOTIFICACIONES (la campana)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  title text not null,
  body text,
  kind text not null default 'general'
    check (kind in ('general', 'comment', 'like', 'medal', 'points', 'event', 'reto', 'pausa')),
  href text,                            -- a dónde lleva el tap
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_member on notifications (member_id, read, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. CLASSROOM (planes, etapas con drip mensual y biblioteca)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  emoji text not null default '📚',
  category text not null default 'biblioteca'
    check (category in ('plan', 'etapa', 'biblioteca')),
  -- Drip: una etapa se abre cuando llega su mes (primer día). Null = siempre abierta.
  opens_month date,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists course_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  title text not null,
  video_url text,                       -- YouTube embed (solo lo carga el staff)
  content_md text,
  duration_label text,                  -- "video · 8 min"
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_lessons_course on course_lessons (course_id, sort_order);

create table if not exists lesson_progress (
  lesson_id uuid not null references course_lessons (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (lesson_id, member_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. STORAGE: fotos de posts, medallas físicas y evidencia de retos
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('post-photos', 'post-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('medal-photos', 'medal-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('evidence', 'evidence', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura: cualquier miembro ve las fotos del blog y las medallas (son de la
-- comunidad); la evidencia solo la ve su dueño (el staff usa service role).
drop policy if exists "miembros ven fotos de posts" on storage.objects;
create policy "miembros ven fotos de posts"
  on storage.objects for select
  using (bucket_id in ('post-photos', 'medal-photos') and (is_member() or is_team()));

drop policy if exists "miembro ve su evidencia" on storage.objects;
create policy "miembro ve su evidencia"
  on storage.objects for select
  using (
    bucket_id = 'evidence'
    and (owner = auth.uid() or is_team())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. ROW LEVEL SECURITY
--     (las server actions usan service role; estas políticas protegen el
--      acceso directo con la anon key y son la última línea de defensa)
-- ─────────────────────────────────────────────────────────────────────────────
alter table community_config  enable row level security;
alter table community_posts   enable row level security;
alter table community_comments enable row level security;
alter table community_likes   enable row level security;
alter table habits            enable row level security;
alter table habit_logs        enable row level security;
alter table pause_requests    enable row level security;
alter table medals            enable row level security;
alter table member_medals     enable row level security;
alter table challenges        enable row level security;
alter table challenge_progress enable row level security;
alter table points_ledger     enable row level security;
alter table event_rsvps       enable row level security;
alter table event_attendance  enable row level security;
alter table notifications     enable row level security;
alter table courses           enable row level security;
alter table course_lessons    enable row level security;
alter table lesson_progress   enable row level security;

-- Config: los miembros la leen (pesos de puntos); solo staff la cambia.
create policy "comunidad lee config" on community_config for select using (is_member() or is_team());
create policy "staff edita config" on community_config for all using (is_staff()) with check (is_staff());

-- Blog: leen todos los miembros; cada uno escribe como sí mismo.
create policy "miembros leen posts" on community_posts for select using (is_member() or is_team());
create policy "miembro publica" on community_posts for insert
  with check (is_member() and author_member_id = current_member_id() and video_url is null and is_pinned = false);
create policy "miembro edita su post" on community_posts for update
  using (author_member_id = current_member_id());
create policy "miembro borra su post" on community_posts for delete
  using (author_member_id = current_member_id());
create policy "staff gestiona posts" on community_posts for all using (is_staff()) with check (is_staff());

create policy "miembros leen comentarios" on community_comments for select using (is_member() or is_team());
create policy "miembro comenta" on community_comments for insert
  with check (is_member() and author_member_id = current_member_id());
create policy "miembro borra su comentario" on community_comments for delete
  using (author_member_id = current_member_id());
create policy "staff gestiona comentarios" on community_comments for all using (is_staff()) with check (is_staff());

create policy "miembros ven likes" on community_likes for select using (is_member() or is_team());
create policy "miembro da like" on community_likes for insert with check (member_id = current_member_id());
create policy "miembro quita su like" on community_likes for delete using (member_id = current_member_id());

-- Hábitos: PRIVADOS. Ni siquiera el staff los lee por RLS (el detalle es del
-- miembro; las métricas agregadas salen por server actions con service role).
create policy "miembro gestiona sus habitos" on habits for all
  using (member_id = current_member_id()) with check (member_id = current_member_id());
create policy "miembro gestiona sus logs" on habit_logs for all
  using (member_id = current_member_id()) with check (member_id = current_member_id());

-- Pausas: el miembro crea y ve las suyas; staff resuelve.
create policy "miembro ve sus pausas" on pause_requests for select using (member_id = current_member_id());
create policy "miembro solicita pausa" on pause_requests for insert with check (member_id = current_member_id());
create policy "staff gestiona pausas" on pause_requests for all using (is_staff()) with check (is_staff());

-- Medallas: catálogo y vitrinas visibles para la comunidad.
create policy "miembros ven catalogo" on medals for select using (is_member() or is_team());
create policy "staff gestiona catalogo" on medals for all using (is_staff()) with check (is_staff());
create policy "miembros ven vitrinas" on member_medals for select using (is_member() or is_team());
create policy "miembro sube medalla fisica" on member_medals for insert
  with check (member_id = current_member_id() and is_physical = true and status = 'en_revision');
create policy "staff gestiona medallas" on member_medals for all using (is_staff()) with check (is_staff());

-- Retos: visibles para todos los miembros; el progreso es de cada uno.
create policy "miembros ven retos" on challenges for select using (is_member() or is_team());
create policy "staff gestiona retos" on challenges for all using (is_staff()) with check (is_staff());
create policy "miembro ve su progreso" on challenge_progress for select using (member_id = current_member_id());
create policy "miembro avanza su reto" on challenge_progress for insert
  with check (member_id = current_member_id() and status in ('en_curso', 'en_verificacion'));
create policy "miembro actualiza su progreso" on challenge_progress for update
  using (member_id = current_member_id() and status in ('en_curso', 'en_verificacion'));
create policy "staff gestiona progreso" on challenge_progress for all using (is_staff()) with check (is_staff());

-- Puntos: el ranking es público entre miembros; solo el staff (o el servidor)
-- escribe.
create policy "miembros ven puntos" on points_ledger for select using (is_member() or is_team());
create policy "staff otorga puntos" on points_ledger for all using (is_staff()) with check (is_staff());

-- RSVP: cada miembro responde lo suyo; el conteo lo ven todos los miembros.
create policy "miembros ven rsvps" on event_rsvps for select using (is_member() or is_team());
create policy "miembro responde rsvp" on event_rsvps for insert with check (member_id = current_member_id());
create policy "miembro cambia su rsvp" on event_rsvps for update using (member_id = current_member_id());

-- Asistencia: cada uno ve la suya; staff importa y ve todo.
create policy "miembro ve su asistencia" on event_attendance for select using (member_id = current_member_id());
create policy "staff gestiona asistencia" on event_attendance for all using (is_staff()) with check (is_staff());

-- Notificaciones: estrictamente propias.
create policy "miembro ve sus notificaciones" on notifications for select using (member_id = current_member_id());
create policy "miembro marca leidas" on notifications for update using (member_id = current_member_id());
create policy "staff crea notificaciones" on notifications for insert with check (is_staff());

-- Classroom: contenido para miembros (el drip por mes lo aplica la app);
-- el progreso es personal.
create policy "miembros ven cursos" on courses for select using (is_member() or is_team());
create policy "staff gestiona cursos" on courses for all using (is_staff()) with check (is_staff());
create policy "miembros ven lecciones" on course_lessons for select using (is_member() or is_team());
create policy "staff gestiona lecciones" on course_lessons for all using (is_staff()) with check (is_staff());
create policy "miembro gestiona su avance" on lesson_progress for all
  using (member_id = current_member_id()) with check (member_id = current_member_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────
drop trigger if exists trg_cposts_updated on community_posts;
create trigger trg_cposts_updated before update on community_posts
  for each row execute function touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. SEED MÍNIMO (idempotente): catálogo de medallas, retos de septiembre,
--     etapas del classroom y planes. Editable después desde el ERP.
-- ─────────────────────────────────────────────────────────────────────────────
insert into medals (name, description, rarity, emoji, kind) values
  ('Primer Social Run', 'Apareciste por primera vez. Ya eres parte.', 'bronce', '🥉', 'hito'),
  ('5 Social Runs', 'Cinco domingos que valieron la pena.', 'plata', '🥈', 'hito'),
  ('10 Social Runs', 'Diez encuentros. Esto ya es un hábito.', 'oro', '🥇', 'hito'),
  ('Primer 10K', 'Tu primera vez en dos dígitos.', 'oro', '🏁', 'hito'),
  ('Racha 8 semanas', 'Dos meses sin soltar.', 'oro', '🔥', 'hito'),
  ('Madrugador', '5 entrenamientos antes de las 8 am.', 'plata', '🌅', 'hito'),
  ('Técnica', 'Reto del mes de septiembre cumplido.', 'oro', '🏅', 'reto'),
  ('Trae un amigo', 'Sumaste a alguien a la comunidad.', 'plata', '🤝', 'reto'),
  ('Nº1 del mes', 'La cima del ranking mensual.', 'oro', '👑', 'ranking')
on conflict (name) do nothing;

insert into challenges (title, description, period, criterio, goal, points, medal_id, month)
select v.title, v.description, v.period, v.criterio, v.goal, v.points,
       (select id from medals where name = v.medal), v.month::date
from (values
  ('12 entrenamientos en septiembre', 'Registra cada entrenamiento con el botón. Lo verificamos al premiar.', 'mes', 'cantidad', 12, 50, 'Técnica', '2026-09-01'),
  ('Sube un video de tu técnica', 'El equipo te da feedback en el grupo.', 'semana', 'evidencia', 1, 15, null, '2026-09-01'),
  ('Asiste al Social Run del domingo', 'Se valida solo con tu asistencia (Evently).', 'semana', 'asistencia', 1, 20, null, '2026-09-01'),
  ('Trae un amigo a un Social Run', 'Tu invitado corre gratis su primera vez.', 'general', 'evidencia', 1, 30, 'Trae un amigo', null)
) as v(title, description, period, criterio, goal, points, medal, month)
where not exists (select 1 from challenges c where c.title = v.title);

insert into courses (title, subtitle, emoji, category, opens_month, sort_order)
select * from (values
  ('Onboarding STRIDE', 'Cómo ocupar tu membresía al máximo', '👋', 'biblioteca', null::date, 0),
  ('Plan 5K', '8 semanas · base aeróbica y adherencia', '5️⃣', 'plan', null, 1),
  ('Plan 10K', '10 semanas · gestión del ritmo', '🔟', 'plan', null, 2),
  ('Plan 21K', '14 semanas · media maratón', '🏅', 'plan', null, 3),
  ('Nutrición', 'Comer para correr y recuperarte', '🥗', 'biblioteca', null, 4),
  ('Movilidad', 'Rutinas cortas pre y post trote', '🧘', 'biblioteca', null, 5),
  ('Fuerza', 'Fuerza básica para corredores', '💪', 'biblioteca', null, 6),
  ('Mentalidad', 'Constancia, hábitos y cabeza', '🧠', 'biblioteca', null, 7),
  ('Club de lectura', 'Libro del mes + sesión en vivo', '📚', 'biblioteca', null, 8),
  ('Etapa 1 · Inicio', 'Entra en ritmo, conoce la comunidad', '🚀', 'etapa', '2026-07-01', 10),
  ('Etapa 2 · Constancia', 'De la motivación al hábito', '📈', 'etapa', '2026-08-01', 11),
  ('Etapa 3 · Técnica', 'Correr mejor, con menos riesgo', '🎯', 'etapa', '2026-09-01', 12),
  ('Etapa 4 · Resistencia', 'Sostener distancia con control', '🛡️', 'etapa', '2026-10-01', 13),
  ('Etapa 5 · Comunidad', 'Correr con otros como centro', '🫂', 'etapa', '2026-11-01', 14),
  ('Etapa 6 · Superación', 'Tu desafío 5K o 10K', '⛰️', 'etapa', '2026-12-01', 15)
) as v(title, subtitle, emoji, category, opens_month, sort_order)
where not exists (select 1 from courses c where c.title = v.title);
