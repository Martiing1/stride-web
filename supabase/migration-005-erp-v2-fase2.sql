-- ============================================================================
-- STRIDE — Migración 005: ERP v2, fase 2
-- Ejecutar sobre schema.sql + 002 + 003 + 004.
--
-- Trae: configuración del sistema (permisos por rol, widgets del dashboard,
-- nombres de columnas de los tableros), fotos de perfil del equipo, y leads
-- con columna "agendado" y etiqueta de temperatura.
-- ============================================================================

-- --- Configuración del sistema (clave/valor) --------------------------------
-- Una sola tabla para lo que se ajusta desde /admin/configuracion: qué módulos
-- ve cada rol, qué widgets muestra el dashboard y cómo se llaman las columnas
-- de los tableros. El socio escribe; el equipo lee (el sidebar la necesita).
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references team_members (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
drop policy if exists "equipo lee configuracion" on app_settings;
create policy "equipo lee configuracion" on app_settings for select using (is_team());
drop policy if exists "socios escriben configuracion" on app_settings;
create policy "socios escriben configuracion"
  on app_settings for all using (is_socio()) with check (is_socio());

-- --- Fotos de perfil del equipo ---------------------------------------------
alter table team_members add column if not exists photo_path text;

-- Bucket privado; las fotos se sirven con URL firmada desde el servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-photos', 'team-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- --- Leads: columna "agendado" y temperatura --------------------------------
-- "agendado" = quedó invitado a la reunión de fin de mes.
alter table leads drop constraint if exists leads_status_check;
alter table leads add constraint leads_status_check
  check (status in ('nuevo', 'contactado', 'agendado', 'convertido', 'descartado'));

-- Qué tan caliente está el lead en términos de información/interés.
alter table leads add column if not exists temperature text
  check (temperature in ('frio', 'tibio', 'caliente'));
