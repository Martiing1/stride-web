-- ============================================================================
-- STRIDE — Migración 008: tareas solo para socios
-- Ejecutar sobre schema.sql + 002…007.
--
-- Algunas tareas (societarias, contratos, finanzas) son solo de los
-- fundadores. La visibilidad se blinda en RLS, no solo en la interfaz:
-- un líder o monitor no puede leerlas NI tocarlas aunque le hable a la API.
-- ============================================================================

alter table tasks add column if not exists visibility text not null default 'equipo'
  check (visibility in ('equipo', 'socios'));

drop policy if exists "equipo lee tareas" on tasks;
create policy "equipo lee tareas"
  on tasks for select
  using (is_team() and (visibility = 'equipo' or is_socio()));

drop policy if exists "staff gestiona tareas" on tasks;
create policy "staff gestiona tareas"
  on tasks for all
  using (is_staff() and (visibility = 'equipo' or is_socio()))
  with check (is_staff() and (visibility = 'equipo' or is_socio()));
