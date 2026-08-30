-- ============================================================================
-- STRIDE — Migración 004: ERP v2, fase 1
-- Ejecutar sobre schema.sql + 002 + 003.
--
-- Trae: inscritos importados de Evently, evaluación post-evento individual y
-- bloqueante, campos internos de eventos, y la planificación con plantilla
-- real (bloques de itinerario, grupos de ritmo con salidas escalonadas y
-- checklist).
-- ============================================================================

-- --- Eventos: datos internos que jamás se muestran en la web pública --------
alter table events add column if not exists internal_notes text;

-- --- Inscritos por evento (import del export de Evently) --------------------
-- La "Fecha de Validación" del export es el check-in en la puerta: con eso
-- salen inscritos vs asistentes sin módulo de check-in propio.
create table if not exists event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  evently_id text,                  -- ID de la fila en Evently
  ci text,
  first_name text not null,
  last_name text,
  email text,
  ticket_type text,
  status text,                      -- ACTIVE, CANCELLED…
  purchased_at timestamptz,
  validated_at timestamptz,         -- null = no llegó
  source text,                      -- COMPRA, CORTESIA…
  imported_at timestamptz not null default now(),
  unique (event_id, evently_id)
);
create index if not exists idx_registrations_event on event_registrations (event_id);
create index if not exists idx_registrations_email on event_registrations (lower(email));

alter table event_registrations enable row level security;
drop policy if exists "staff gestiona inscritos" on event_registrations;
create policy "staff gestiona inscritos"
  on event_registrations for all using (is_staff()) with check (is_staff());
drop policy if exists "equipo lee inscritos" on event_registrations;
create policy "equipo lee inscritos"
  on event_registrations for select using (is_team());

-- --- Evaluación post-evento: individual y bloqueante ------------------------
-- Cada persona del equipo rellena la suya; mientras no lo haga, SU ERP queda
-- bloqueado (la puerta está en el layout del admin, no acá).
create table if not exists event_evaluations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  team_member_id uuid not null references team_members (id) on delete cascade,
  attended boolean not null default true,
  rating_overall smallint check (rating_overall between 1 and 5),
  rating_team smallint check (rating_team between 1 and 5),
  rating_safety smallint check (rating_safety between 1 and 5),
  rating_timing smallint check (rating_timing between 1 and 5),
  highlights text,
  improvements text,
  incidents text,
  created_at timestamptz not null default now(),
  unique (event_id, team_member_id)
);
create index if not exists idx_evaluations_member on event_evaluations (team_member_id);

alter table event_evaluations enable row level security;
drop policy if exists "equipo lee evaluaciones" on event_evaluations;
create policy "equipo lee evaluaciones"
  on event_evaluations for select using (is_team());
drop policy if exists "cada uno escribe su evaluacion" on event_evaluations;
create policy "cada uno escribe su evaluacion"
  on event_evaluations for insert with check (
    team_member_id in (select id from team_members where auth_user_id = auth.uid())
  );
drop policy if exists "cada uno corrige su evaluacion" on event_evaluations;
create policy "cada uno corrige su evaluacion"
  on event_evaluations for update using (
    team_member_id in (select id from team_members where auth_user_id = auth.uid())
  );

-- --- Planificación: responsables que faltaban -------------------------------
alter table event_plans add column if not exists planner_id uuid references team_members (id) on delete set null;
alter table event_plans add column if not exists route_owner_id uuid references team_members (id) on delete set null;

-- --- Itinerario por bloques (INICIO / FINAL / ESPACIO SOCIAL) ---------------
-- Réplica de la plantilla real: hora, encargado, actividad y notas por fila.
-- El encargado es texto libre a propósito: en la plantilla aparecen personas,
-- marcas ("Starbucks") y colectivos ("Todos", "Monitores").
create table if not exists plan_blocks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references event_plans (id) on delete cascade,
  section text not null check (section in ('inicio', 'final', 'social')),
  block_time time,
  leader_label text,
  activity text not null,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_plan_blocks_plan on plan_blocks (plan_id, section, sort_order);

-- --- Grupos de ritmo con salidas escalonadas --------------------------------
-- Cada grupo corre su distancia a su pace y descansa por su cuenta; el offset
-- de salida se calcula para que todos lleguen a la misma hora.
create table if not exists plan_pace_groups (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references event_plans (id) on delete cascade,
  name text not null,               -- "3K principiantes"
  distance_km numeric(4, 2) not null,
  pace_sec_per_km integer not null, -- 7:30 min/km = 450
  break_min integer not null default 0,
  leaders text,                     -- "Tebo, Martín, Gemma"
  start_offset_min integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_pace_groups_plan on plan_pace_groups (plan_id, sort_order);

-- --- Checklist de la planificación ------------------------------------------
create table if not exists plan_checklist_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references event_plans (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_plan_checklist_plan on plan_checklist_items (plan_id, sort_order);

-- RLS de las tablas hijas de la planificación: mismo criterio que event_plans.
alter table plan_blocks enable row level security;
alter table plan_pace_groups enable row level security;
alter table plan_checklist_items enable row level security;

drop policy if exists "equipo lee bloques" on plan_blocks;
create policy "equipo lee bloques" on plan_blocks for select using (is_team());
drop policy if exists "staff gestiona bloques" on plan_blocks;
create policy "staff gestiona bloques" on plan_blocks for all using (is_staff()) with check (is_staff());

drop policy if exists "equipo lee grupos" on plan_pace_groups;
create policy "equipo lee grupos" on plan_pace_groups for select using (is_team());
drop policy if exists "staff gestiona grupos" on plan_pace_groups;
create policy "staff gestiona grupos" on plan_pace_groups for all using (is_staff()) with check (is_staff());

drop policy if exists "equipo lee checklist plan" on plan_checklist_items;
create policy "equipo lee checklist plan" on plan_checklist_items for select using (is_team());
drop policy if exists "staff gestiona checklist plan" on plan_checklist_items;
create policy "staff gestiona checklist plan" on plan_checklist_items for all using (is_staff()) with check (is_staff());
