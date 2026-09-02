-- ============================================================================
-- Migración 017 · ERP v3 (02-09-2026)
-- Aditiva. Se ejecuta vía Management API (SUPABASE_ACCESS_TOKEN en .env.local).
-- ============================================================================

-- ── Actas reservadas a socios ────────────────────────────────────────────────
alter table meetings add column if not exists visibility text not null default 'equipo'
  check (visibility in ('equipo', 'socios'));

drop policy if exists "equipo lee actas" on meetings;
create policy "equipo lee actas"
  on meetings for select using (is_team() and (visibility = 'equipo' or is_socio()));

-- ── Planificación: ruta escrita a mano (sin necesidad de ficha en Rutas) ─────
alter table event_plans add column if not exists route_text text;

-- ── Rutas: distancias que se corren (3K/5K) e imágenes ───────────────────────
alter table routes add column if not exists distances_km numeric[] not null default '{}';
alter table routes add column if not exists image_urls text[] not null default '{}';

-- ── Leads: etiquetas libres además de la temperatura ─────────────────────────
alter table leads add column if not exists tags text[] not null default '{}';

-- ── Plan del mes: responsable escrito (cuando no es Martín ni Juanjo) ────────
alter table membership_month_items add column if not exists assignee_label text;

-- ── Equipo: columnas extra configurables (clave/valor por persona) ───────────
alter table team_members add column if not exists extra jsonb not null default '{}'::jsonb;

-- ── Eventos: solo socios eliminan (RLS de respaldo) ──────────────────────────
drop policy if exists "socios eliminan eventos" on events;
create policy "socios eliminan eventos"
  on events for delete using (is_socio());
