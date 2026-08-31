-- ============================================================================
-- STRIDE — Migración 009: historial de cambios de tareas
-- Ejecutar sobre schema.sql + 002…008.
--
-- Cada cambio de parámetro de una tarea (título, responsable, fecha, estado,
-- prioridad, visibilidad, notas) queda registrado con quién lo hizo y cuándo.
-- ============================================================================

create table if not exists task_audit_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  changed_by uuid references team_members (id) on delete set null,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_audit_task on task_audit_log (task_id, created_at desc);

alter table task_audit_log enable row level security;

-- El historial hereda la visibilidad de la tarea: el registro de una tarea
-- "solo socios" tampoco lo ven líderes ni monitores.
drop policy if exists "equipo lee historial de tareas" on task_audit_log;
create policy "equipo lee historial de tareas"
  on task_audit_log for select
  using (
    is_team() and exists (
      select 1 from tasks t
      where t.id = task_audit_log.task_id
        and (t.visibility = 'equipo' or is_socio())
    )
  );

drop policy if exists "equipo registra cambios" on task_audit_log;
create policy "equipo registra cambios"
  on task_audit_log for insert
  with check (is_team());
