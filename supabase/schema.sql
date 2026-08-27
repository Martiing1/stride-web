-- ============================================================================
-- STRIDE — Schema Supabase (Postgres)
-- Plataforma pública (stridechile.cl) + ERP interno (admin.stridechile.cl)
-- Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. EQUIPO INTERNO
-- ============================================================================

-- Personas del equipo STRIDE. Cada una se enlaza a una cuenta de Supabase Auth
-- cuando se le da acceso al ERP (auth_user_id).
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  nickname text,
  email text not null unique,
  phone text,
  role text not null default 'monitor'
    check (role in ('socio', 'lider_comunidad', 'monitor')),
  area text,
  status text not null default 'activo' check (status in ('activo', 'inactivo')),
  created_at timestamptz not null default now()
);

comment on column team_members.role is
  'socio = acceso total | lider_comunidad = eventos, rutas y tareas del equipo | monitor = solo lo propio';

-- ============================================================================
-- 2. ACTAS, TAREAS, DECISIONES Y SEGUIMIENTOS
-- ============================================================================

-- Actas de reunión. Martín pega el acta ya redactada (que incluye el bloque
-- AUTO_PROCESSING) y el sistema desglosa tareas, decisiones y seguimientos.
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  code text unique,                 -- ej. ACTA_STRIDE_20260701
  title text not null,
  meeting_date date not null,
  attendees text[] not null default '{}',
  content_md text not null,         -- acta completa en markdown
  raw_block text,                   -- bloque AUTO_PROCESSING crudo, para trazabilidad
  created_by uuid references team_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assignee_id uuid references team_members (id) on delete set null,
  -- El acta a veces trae responsables compuestos ("Nicolás / Fernanda",
  -- "Equipo de planificación"). Se guarda el texto literal y se enlaza
  -- assignee_id solo cuando se puede resolver a una persona concreta.
  assignee_label text,
  area text,
  priority text not null default 'media' check (priority in ('alta', 'media', 'baja')),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'en_progreso', 'hecha', 'recurrente', 'bloqueada')),
  start_date date,
  due_date date,
  meeting_id uuid references meetings (id) on delete set null,
  event_id uuid,                    -- FK agregada más abajo, tras crear events
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Decisiones tomadas en la reunión (líneas DECISION y DOC_UPDATE del bloque).
create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  area text,
  kind text,                        -- proceso_nuevo, reemplazo, comunicacion...
  priority text check (priority in ('alta', 'media', 'baja')),
  content text not null,
  is_doc_update boolean not null default false,
  created_at timestamptz not null default now()
);

-- Temas a retomar en la próxima reunión (líneas SEGUIMIENTO).
create table if not exists followups (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  area text,
  content text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 3. EVENTOS Y SOCIAL RUNS
-- ============================================================================

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  code text unique,                 -- ej. EVT-001
  title text not null,
  event_type text not null default 'social_run'
    check (event_type in ('social_run', 'social_run_cafeteria', 'social_run_sunset', 'marca', 'retiro', 'race_trip', 'otro')),
  event_date date not null,
  event_time time,
  meeting_point text,
  meeting_point_map_url text,
  route_gpx_url text,
  distance_km numeric(5, 2),
  evently_url text,                 -- link propio de ticketera por evento
  cover_image_url text,
  -- Cupos. Como la inscripción ocurre en Evently, esto se actualiza a mano:
  -- sirve para mostrar "Quedan N cupos" y generar urgencia real, no inventada.
  -- Dejar en null si el evento no tiene tope.
  capacity integer,
  spots_left integer,
  owner_id uuid references team_members (id) on delete set null,
  -- Flujo de decisión: domingo se abre la encuesta, se cierra domingo PM y el
  -- evento se confirma solo si hay al menos min_confirmations personas.
  status text not null default 'planificacion'
    check (status in ('planificacion', 'encuesta_abierta', 'confirmado', 'cancelado', 'completado')),
  min_confirmations integer not null default 3,
  is_public boolean not null default false,   -- si aparece en /eventos
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tasks
  drop constraint if exists tasks_event_id_fkey;
alter table tasks
  add constraint tasks_event_id_fkey
  foreign key (event_id) references events (id) on delete set null;

-- Encuesta de disponibilidad del equipo para cada evento.
create table if not exists event_availability (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  team_member_id uuid not null references team_members (id) on delete cascade,
  response text not null check (response in ('si', 'no', 'tal_vez')),
  note text,
  responded_at timestamptz not null default now(),
  unique (event_id, team_member_id)
);

-- Cuántos confirmaron y si el evento alcanza el mínimo para realizarse.
create or replace view event_confirmation_status as
select
  e.id                                        as event_id,
  e.title,
  e.event_date,
  e.status,
  e.min_confirmations,
  count(*) filter (where a.response = 'si')   as confirmed_count,
  count(*) filter (where a.response = 'no')   as declined_count,
  count(*) filter (where a.response = 'tal_vez') as maybe_count,
  count(*) filter (where a.response = 'si') >= e.min_confirmations as meets_minimum
from events e
left join event_availability a on a.event_id = e.id
group by e.id;

-- ============================================================================
-- 4. MEMBRESÍA STRIDE ONE
-- ============================================================================

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  -- Va dentro del QR: stridechile.cl/validar/<member_code>. Público por diseño.
  member_code text not null unique,
  -- Link privado de la tarjeta virtual: stridechile.cl/tarjeta/<card_token>.
  -- Es un secreto: quien lo tiene ve la tarjeta. Se comparte solo por WhatsApp.
  card_token text not null unique,
  full_name text not null,
  photo_url text,
  email text,
  whatsapp text,
  plan text not null default 'stride_one',
  status text not null default 'inactiva'
    check (status in ('activa', 'inactiva', 'pausada')),
  joined_at date not null default current_date,
  valid_until date,
  skool_handle text,                -- usuario en Skool, donde se cobra
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una membresía está vigente si está activa y no venció.
create or replace function member_is_valid(m members)
returns boolean
language sql
immutable
as $$
  select m.status = 'activa'
     and (m.valid_until is null or m.valid_until >= current_date);
$$;

-- ============================================================================
-- 5. CONVENIOS Y BENEFICIOS
-- ============================================================================

create table if not exists benefits (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  category text not null,           -- kinesiologia, nutricion, masoterapia, podologia, cafeteria...
  description text not null,
  discount_label text,              -- ej. "20% OFF"
  address text,
  instagram text,
  logo_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 5b. TESTIMONIOS
-- ============================================================================

-- Lo que dice la gente de la comunidad. Se muestra en la landing.
create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_role text,                 -- "Miembro desde 2025", "Social Runner"...
  photo_url text,
  quote text not null,
  rating smallint check (rating between 1 and 5),
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 6. ESCANEOS / CANJES
-- ============================================================================

-- Cada vez que un comercio escanea el QR de un miembro queda registrado aquí,
-- con geolocalización cuando el navegador la entrega.
create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members (id) on delete set null,
  member_code text not null,        -- se guarda aunque el código no exista (intento fallido)
  benefit_id uuid references benefits (id) on delete set null,
  was_valid boolean not null,       -- resultado que vio el comercio en ese momento
  scanned_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  -- 'gps' = el comercio autorizó ubicación | 'denegado' = la rechazó
  -- | 'no_disponible' = el dispositivo no la entregó
  geo_source text not null default 'no_disponible'
    check (geo_source in ('gps', 'denegado', 'no_disponible')),
  user_agent text
);

create index if not exists idx_scans_member on scans (member_id, scanned_at desc);
create index if not exists idx_scans_date on scans (scanned_at desc);

-- ============================================================================
-- 7. LEADS
-- ============================================================================

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  whatsapp text not null,
  -- Qué busca la persona. Es la única pregunta del formulario y define a qué
  -- se le responde: 'membresia' entra directo al pitch de STRIDE ONE.
  motivation text not null
    check (motivation in ('social_run', 'constancia', 'membresia')),
  -- Se dejó de preguntar en el formulario (agregaba fricción sin usarse).
  -- La columna se conserva para los leads antiguos.
  running_experience text
    check (running_experience in ('nunca', 'ocasional', 'regular', 'competitivo')),
  source text not null default 'landing',
  -- Evidencia del consentimiento recabado en la landing. La autorización para
  -- novedades es independiente y opcional.
  contact_consent boolean not null default false,
  marketing_consent boolean not null default false,
  consent_version text,
  consented_at timestamptz,
  status text not null default 'nuevo'
    check (status in ('nuevo', 'contactado', 'convertido', 'descartado')),
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 8. INVENTARIO DE KITS
-- ============================================================================

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- Polera, Medalla, Lanyard, Sticker, Bolsa
  category text,
  size text,                        -- S, M, L, XL (null para lo que no aplica)
  stock integer not null default 0,
  unit_cost_clp integer,
  created_at timestamptz not null default now()
);

create table if not exists kit_deliveries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  item_id uuid not null references inventory_items (id) on delete restrict,
  quantity integer not null default 1,
  status text not null default 'pendiente' check (status in ('pendiente', 'entregado')),
  delivered_at timestamptz,
  delivered_by uuid references team_members (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 9. FINANZAS
-- ============================================================================

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ingreso', 'gasto')),
  amount_clp integer not null check (amount_clp >= 0),
  category text not null,           -- membresia, sponsor, kits, premios, produccion...
  description text,
  event_id uuid references events (id) on delete set null,
  member_id uuid references members (id) on delete set null,
  occurred_on date not null default current_date,
  created_by uuid references team_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_date on transactions (occurred_on desc);

-- ============================================================================
-- 10. HELPERS DE AUTORIZACIÓN
-- ============================================================================

-- Rol del usuario autenticado, o null si no pertenece al equipo.
create or replace function current_role_stride()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from team_members
  where auth_user_id = auth.uid() and status = 'activo'
  limit 1;
$$;

create or replace function is_socio()
returns boolean
language sql
stable
as $$ select current_role_stride() = 'socio'; $$;

-- Socios y líderes de comunidad pueden gestionar operación.
create or replace function is_staff()
returns boolean
language sql
stable
as $$ select current_role_stride() in ('socio', 'lider_comunidad'); $$;

-- Cualquier miembro activo del equipo.
create or replace function is_team()
returns boolean
language sql
stable
as $$ select current_role_stride() is not null; $$;

-- ============================================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================================

alter table testimonials      enable row level security;
alter table team_members      enable row level security;
alter table meetings          enable row level security;
alter table tasks             enable row level security;
alter table decisions         enable row level security;
alter table followups         enable row level security;
alter table events            enable row level security;
alter table event_availability enable row level security;
alter table members           enable row level security;
alter table benefits          enable row level security;
alter table scans             enable row level security;
alter table leads             enable row level security;
alter table inventory_items   enable row level security;
alter table kit_deliveries    enable row level security;
alter table transactions      enable row level security;

-- --- Público (sin sesión) -----------------------------------------------
-- Solo lo que alimenta la web pública. members y scans NUNCA se leen con la
-- anon key: /validar y /tarjeta pasan por API routes con service role.

create policy "public lee beneficios activos"
  on benefits for select
  using (active = true);

create policy "public lee eventos publicos"
  on events for select
  using (is_public = true and status in ('confirmado', 'completado'));

create policy "public lee testimonios publicados"
  on testimonials for select
  using (published = true);

-- Cualquiera puede dejar un lead desde la landing, nadie puede leerlos.
create policy "public crea leads"
  on leads for insert
  with check (true);

-- --- Equipo -------------------------------------------------------------

create policy "equipo lee equipo"
  on team_members for select using (is_team());
create policy "socios gestionan equipo"
  on team_members for all using (is_socio()) with check (is_socio());

create policy "equipo lee actas"
  on meetings for select using (is_team());
create policy "staff gestiona actas"
  on meetings for all using (is_staff()) with check (is_staff());

-- Todo el equipo ve las tareas; un monitor solo puede editar las suyas.
create policy "equipo lee tareas"
  on tasks for select using (is_team());
create policy "staff gestiona tareas"
  on tasks for all using (is_staff()) with check (is_staff());
create policy "monitor actualiza sus tareas"
  on tasks for update
  using (
    assignee_id in (select id from team_members where auth_user_id = auth.uid())
  );

create policy "equipo lee decisiones"
  on decisions for select using (is_team());
create policy "staff gestiona decisiones"
  on decisions for all using (is_staff()) with check (is_staff());

create policy "equipo lee seguimientos"
  on followups for select using (is_team());
create policy "staff gestiona seguimientos"
  on followups for all using (is_staff()) with check (is_staff());

create policy "equipo lee eventos"
  on events for select using (is_team());
create policy "staff gestiona eventos"
  on events for all using (is_staff()) with check (is_staff());

-- Cada persona responde su propia disponibilidad; todo el equipo ve el conteo.
create policy "equipo lee disponibilidad"
  on event_availability for select using (is_team());
create policy "equipo responde su disponibilidad"
  on event_availability for insert
  with check (
    team_member_id in (select id from team_members where auth_user_id = auth.uid())
  );
create policy "equipo cambia su disponibilidad"
  on event_availability for update
  using (
    team_member_id in (select id from team_members where auth_user_id = auth.uid())
  );

-- Datos de miembros: solo socios y líderes. Un monitor no ve la base de pagos.
create policy "staff gestiona miembros"
  on members for all using (is_staff()) with check (is_staff());

create policy "staff gestiona testimonios"
  on testimonials for all using (is_staff()) with check (is_staff());

create policy "equipo lee beneficios"
  on benefits for select using (is_team());
create policy "staff gestiona beneficios"
  on benefits for all using (is_staff()) with check (is_staff());

create policy "staff lee escaneos"
  on scans for select using (is_staff());

create policy "staff gestiona leads"
  on leads for all using (is_staff()) with check (is_staff());

create policy "equipo lee inventario"
  on inventory_items for select using (is_team());
create policy "staff gestiona inventario"
  on inventory_items for all using (is_staff()) with check (is_staff());

create policy "equipo lee entregas"
  on kit_deliveries for select using (is_team());
create policy "staff gestiona entregas"
  on kit_deliveries for all using (is_staff()) with check (is_staff());

-- Finanzas: solo socios.
create policy "socios gestionan finanzas"
  on transactions for all using (is_socio()) with check (is_socio());

-- ============================================================================
-- 12. TRIGGERS
-- ============================================================================

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tasks_updated on tasks;
create trigger trg_tasks_updated before update on tasks
  for each row execute function touch_updated_at();

drop trigger if exists trg_members_updated on members;
create trigger trg_members_updated before update on members
  for each row execute function touch_updated_at();

drop trigger if exists trg_events_updated on events;
create trigger trg_events_updated before update on events
  for each row execute function touch_updated_at();
