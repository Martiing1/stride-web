-- ============================================================================
-- STRIDE — Migración 011: Libro de Incumplimientos
-- Ejecutar sobre schema.sql + 002…010.
--
-- Implementa el capítulo 10 del Pacto de Socios: el registro oficial de faltas,
-- con los nueve campos mínimos que exige el 10.1, el derecho a descargos y
-- subsanación (10.2), la acumulación que configura un Incumplimiento Relevante
-- (10.3) y el Plan de Mejora de 30 días (10.4).
--
-- Aplica a socios y a líderes/monitores por igual: la tabla apunta a
-- team_members, no a un rol.
-- ============================================================================

create table if not exists incumplimientos (
  id uuid primary key default gen_random_uuid(),

  -- 10.1.a) socio o miembro del equipo involucrado
  team_member_id uuid not null references team_members (id) on delete cascade,
  -- 10.1.b) output, obligación o conducta afectada
  subject text not null,
  task_id uuid references tasks (id) on delete set null,
  event_id uuid references events (id) on delete set null,
  -- 10.1.c) fecha del incumplimiento
  occurred_on date not null default current_date,
  -- 10.1.d) antecedentes o medios de respaldo
  evidence text,
  -- 10.1.e) fecha de notificación al involucrado
  notified_at timestamptz,
  -- 10.1.f) descargos presentados (5 días hábiles desde la notificación)
  member_response text,
  responded_at timestamptz,
  -- 10.1.g) plazo y resultado de la subsanación
  remediation_due date,
  remediation_result text,
  -- 10.1.h) calificación final de la falta
  classification text not null default 'sin_calificar'
    check (classification in ('sin_calificar', 'subsanado', 'leve_efectivo', 'grave_directo')),
  -- 10.1.i) medidas adoptadas
  measures text,

  status text not null default 'registrado'
    check (status in ('registrado', 'notificado', 'con_descargos', 'cerrado', 'anulado')),
  registered_by uuid references team_members (id) on delete set null,
  drive_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_incumplimientos_member on incumplimientos (team_member_id, occurred_on desc);

-- 10.4: Plan de Mejora de 30 días corridos, obligatorio tras un Relevante.
create table if not exists improvement_plans (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members (id) on delete cascade,
  started_on date not null default current_date,
  due_on date not null,
  deficiencies text not null,        -- a) conductas o deficiencias a corregir
  outputs text not null,             -- b) outputs específicos comprometidos
  acceptance_criteria text,          -- d) criterios objetivos de aceptación
  support text,                      -- e) medidas de apoyo o redistribución
  result text not null default 'en_curso'
    check (result in ('en_curso', 'cumplido', 'incumplido')),
  closing_notes text,
  created_by uuid references team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_planes_member on improvement_plans (team_member_id, started_on desc);

-- 10.3: tres leves efectivos en seis meses = Incumplimiento Relevante.
create or replace view incumplimientos_acumulados as
select
  team_member_id,
  count(*) filter (
    where classification = 'leve_efectivo'
      and occurred_on >= current_date - interval '6 months'
  ) as leves_6m,
  count(*) filter (where classification = 'grave_directo') as graves,
  max(occurred_on) as ultimo
from incumplimientos
where status <> 'anulado'
group by team_member_id;

alter table incumplimientos enable row level security;
alter table improvement_plans enable row level security;

drop policy if exists "socios gestionan incumplimientos" on incumplimientos;
create policy "socios gestionan incumplimientos"
  on incumplimientos for all using (is_socio()) with check (is_socio());

-- Nadie puede ser registrado en secreto: cada uno ve lo suyo.
drop policy if exists "cada uno lee sus incumplimientos" on incumplimientos;
create policy "cada uno lee sus incumplimientos"
  on incumplimientos for select
  using (team_member_id in (select id from team_members where auth_user_id = auth.uid()));

drop policy if exists "cada uno presenta descargos" on incumplimientos;
create policy "cada uno presenta descargos"
  on incumplimientos for update
  using (team_member_id in (select id from team_members where auth_user_id = auth.uid()));

drop policy if exists "socios gestionan planes" on improvement_plans;
create policy "socios gestionan planes"
  on improvement_plans for all using (is_socio()) with check (is_socio());
drop policy if exists "cada uno lee su plan" on improvement_plans;
create policy "cada uno lee su plan"
  on improvement_plans for select
  using (team_member_id in (select id from team_members where auth_user_id = auth.uid()));

-- Un no-socio solo puede escribir sus descargos: todo lo demás vuelve a su valor.
create or replace function guard_incumplimiento_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_socio() then
    return new;
  end if;
  new.team_member_id     := old.team_member_id;
  new.subject            := old.subject;
  new.task_id            := old.task_id;
  new.event_id           := old.event_id;
  new.occurred_on        := old.occurred_on;
  new.evidence           := old.evidence;
  new.notified_at        := old.notified_at;
  new.remediation_due    := old.remediation_due;
  new.remediation_result := old.remediation_result;
  new.classification     := old.classification;
  new.measures           := old.measures;
  new.registered_by      := old.registered_by;
  new.drive_url          := old.drive_url;
  -- Presentar descargos avanza el estado; nada más lo mueve.
  if new.member_response is distinct from old.member_response then
    new.status := 'con_descargos';
    new.responded_at := now();
  else
    new.status := old.status;
  end if;
  return new;
end $$;

drop trigger if exists incumplimientos_guard on incumplimientos;
create trigger incumplimientos_guard
  before update on incumplimientos
  for each row execute function guard_incumplimiento_update();

drop trigger if exists incumplimientos_touch on incumplimientos;
create trigger incumplimientos_touch
  before update on incumplimientos
  for each row execute function touch_updated_at();

drop trigger if exists planes_touch on improvement_plans;
create trigger planes_touch
  before update on improvement_plans
  for each row execute function touch_updated_at();
