-- ============================================================================
-- STRIDE — Migración 002: módulo Social Run, checklist de membresía y finanzas
--
-- schema.sql ya está ejecutado; esto se corre ENCIMA, sin borrar nada.
-- Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================================

-- ============================================================================
-- 1. RUTAS
-- ============================================================================

-- Catálogo de rutas reutilizables. Una ruta se traza una vez y se usa en
-- muchos eventos, en vez de re-describirla en cada planificación.
create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  distance_km numeric(5, 2),
  difficulty text check (difficulty in ('facil', 'media', 'dificil')),
  start_point text,
  end_point text,
  gpx_url text,                     -- archivo en el bucket 'rutas'
  external_url text,                -- Strava, Google Maps, Wikiloc…
  -- Seguridad: es lo que decide si una ruta sirve para un grupo grande.
  traffic_lights integer,           -- cuántos cruces con semáforo
  safety_notes text,                -- cruces peligrosos, tramos sin luz, etc.
  surface text,                     -- asfalto, tierra, mixto
  notes text,
  created_by uuid references team_members (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un evento puede apoyarse en una ruta del catálogo.
alter table events add column if not exists route_id uuid references routes (id) on delete set null;

-- ============================================================================
-- 2. PLANIFICACIONES DE EVENTO
-- ============================================================================

-- Planificación estructurada que llenan Fer y Nico. Reemplaza el documento de
-- Drive: al ser campos y no un archivo, se puede leer desde el celular en
-- terreno y comparar entre eventos.
create table if not exists event_plans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references events (id) on delete cascade,

  -- Logística
  route_id uuid references routes (id) on delete set null,
  meeting_time time,
  warmup_notes text,                -- calentamiento
  icebreaker text,                  -- dinámica rompehielo (obligatoria por acta)
  groups_notes text,                -- cómo se dividen los grupos de ritmo
  post_run_notes text,              -- café, juegos, sorteos, premios

  -- Equipo en terreno
  lead_id uuid references team_members (id) on delete set null,
  sweeper_id uuid references team_members (id) on delete set null,  -- cierra el grupo
  photographer_id uuid references team_members (id) on delete set null,

  -- Preparativos
  materials text,                   -- conos, hidratación, botiquín, banderas
  sponsor_notes text,               -- qué aporta la marca y qué se le debe
  contingency text,                 -- plan si llueve o falta gente

  status text not null default 'borrador'
    check (status in ('borrador', 'lista', 'ejecutada')),
  created_by uuid references team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 3. CHECKLIST MENSUAL DE LA MEMBRESÍA
-- ============================================================================

-- Plantilla: los ítems que se repiten todos los meses.
create table if not exists membership_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,                    -- contenido, comunidad, kits, retos
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Instancia del mes: se generan desde la plantilla y se van marcando.
-- `month` guarda siempre el día 1 (ej. 2026-09-01) para identificar el mes.
create table if not exists membership_month_items (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  template_id uuid references membership_checklist_templates (id) on delete set null,
  title text not null,
  category text,
  notes text,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references team_members (id) on delete set null,
  assignee_id uuid references team_members (id) on delete set null,
  due_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_month_items on membership_month_items (month, sort_order);

/*
 * Genera el checklist de un mes desde la plantilla activa.
 * Es idempotente: si el ítem ya existe para ese mes no lo duplica, así que se
 * puede llamar de nuevo tras agregar un ítem nuevo a la plantilla.
 */
create or replace function generate_month_checklist(target_month date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
  first_day date := date_trunc('month', target_month)::date;
begin
  insert into membership_month_items (month, template_id, title, category, sort_order)
  select first_day, t.id, t.title, t.category, t.sort_order
  from membership_checklist_templates t
  where t.active
    and not exists (
      select 1 from membership_month_items m
      where m.month = first_day and m.template_id = t.id
    );

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- ============================================================================
-- 4. FINANZAS
-- ============================================================================

-- Comprobante (boleta, transferencia) por movimiento, en el bucket 'comprobantes'.
alter table transactions add column if not exists receipt_url text;
alter table transactions add column if not exists payment_method text;

-- Resumen por mes, para el balance y la comparación con meses anteriores.
create or replace view monthly_finance_summary as
select
  date_trunc('month', occurred_on)::date                       as month,
  sum(amount_clp) filter (where kind = 'ingreso')              as ingresos,
  sum(amount_clp) filter (where kind = 'gasto')                as gastos,
  coalesce(sum(amount_clp) filter (where kind = 'ingreso'), 0)
    - coalesce(sum(amount_clp) filter (where kind = 'gasto'), 0) as resultado,
  count(*)                                                     as movimientos
from transactions
group by 1
order by 1 desc;

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

alter table routes                            enable row level security;
alter table event_plans                       enable row level security;
alter table membership_checklist_templates    enable row level security;
alter table membership_month_items            enable row level security;

-- Rutas y planificaciones: todo el equipo las lee (las necesitan en terreno),
-- socios y líderes las editan.
create policy "equipo lee rutas" on routes for select using (is_team());
create policy "staff gestiona rutas" on routes for all using (is_staff()) with check (is_staff());

create policy "equipo lee planificaciones" on event_plans for select using (is_team());
create policy "staff gestiona planificaciones" on event_plans for all using (is_staff()) with check (is_staff());

create policy "equipo lee plantilla checklist" on membership_checklist_templates for select using (is_team());
create policy "staff gestiona plantilla checklist" on membership_checklist_templates for all using (is_staff()) with check (is_staff());

create policy "equipo lee checklist del mes" on membership_month_items for select using (is_team());
create policy "staff gestiona checklist del mes" on membership_month_items for all using (is_staff()) with check (is_staff());

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

drop trigger if exists trg_routes_updated on routes;
create trigger trg_routes_updated before update on routes
  for each row execute function touch_updated_at();

drop trigger if exists trg_event_plans_updated on event_plans;
create trigger trg_event_plans_updated before update on event_plans
  for each row execute function touch_updated_at();

-- ============================================================================
-- 7. STORAGE
-- ============================================================================

-- 'rutas' es público: los GPX se comparten con los corredores.
-- 'comprobantes' es privado: son documentos contables internos.
insert into storage.buckets (id, name, public)
values ('rutas', 'rutas', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

drop policy if exists "publico lee rutas" on storage.objects;
create policy "publico lee rutas" on storage.objects
  for select using (bucket_id = 'rutas');

drop policy if exists "staff sube rutas" on storage.objects;
create policy "staff sube rutas" on storage.objects
  for insert with check (bucket_id = 'rutas' and is_staff());

drop policy if exists "staff borra rutas" on storage.objects;
create policy "staff borra rutas" on storage.objects
  for delete using (bucket_id = 'rutas' and is_staff());

drop policy if exists "socios leen comprobantes" on storage.objects;
create policy "socios leen comprobantes" on storage.objects
  for select using (bucket_id = 'comprobantes' and is_socio());

drop policy if exists "socios suben comprobantes" on storage.objects;
create policy "socios suben comprobantes" on storage.objects
  for insert with check (bucket_id = 'comprobantes' and is_socio());

drop policy if exists "socios borran comprobantes" on storage.objects;
create policy "socios borran comprobantes" on storage.objects
  for delete using (bucket_id = 'comprobantes' and is_socio());

-- ============================================================================
-- 8. PLANTILLA INICIAL DEL CHECKLIST
-- ============================================================================
-- Sacada del Módulo 4 de la especificación del ERP. Ajustar a gusto desde
-- /admin/membresia.

insert into membership_checklist_templates (title, category, description, sort_order) values
  ('Clase en vivo de bienvenida',      'contenido', 'Meet de apertura del mes con los miembros.',                 1),
  ('Clase en vivo de cierre',          'contenido', 'Meet de cierre, revisión del mes y próximos pasos.',         2),
  ('Libro del mes publicado',          'contenido', 'Seleccionar libro, subir PDF y abrir formulario de preguntas.', 3),
  ('Sesión de club de lectura',        'comunidad', 'Agendar y realizar la sesión grupal del libro.',             4),
  ('Micro-retos semanales cargados',   'retos',     'Publicar los retos de constancia de las 4 semanas.',         5),
  ('Ranking del mes publicado',        'retos',     'Tabla de posiciones y entrega de premios.',                  6),
  ('Plan de entrenamiento actualizado','contenido', 'Revisar y publicar los planes 5K, 10K y 21K del mes.',        7),
  ('Kits pendientes entregados',       'kits',      'Coordinar entregas en cafetería o Social Run.',              8),
  ('Radar de churn revisado',          'comunidad', 'Detectar miembros inactivos y hacer seguimiento por WhatsApp.', 9),
  ('Cobros del mes conciliados',       'kits',      'Revisar pagos en Skool y actualizar vigencias en el ERP.',   10)
on conflict do nothing;
