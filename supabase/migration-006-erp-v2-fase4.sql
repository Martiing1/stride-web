-- ============================================================================
-- STRIDE — Migración 006: ERP v2, fases 3 y 4
-- Ejecutar sobre schema.sql + 002 + 003 + 004 + 005.
--
-- Trae: presupuestos de finanzas, paquetes de kits (kit de inicio) y
-- coordenadas de los convenios para cruzar escaneos con locales.
-- ============================================================================

-- --- Presupuestos mensuales por categoría ------------------------------------
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2024 and 2100),
  month integer not null check (month between 1 and 12),
  category text not null,
  kind text not null default 'gasto' check (kind in ('ingreso', 'gasto')),
  planned_clp integer not null check (planned_clp >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (year, month, category, kind)
);

alter table budgets enable row level security;
drop policy if exists "socios gestionan presupuestos" on budgets;
create policy "socios gestionan presupuestos"
  on budgets for all using (is_socio()) with check (is_socio());

-- --- Paquetes de kits (ej: kit de inicio = polera + sticker + lanyard) -------
create table if not exists kit_bundles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists kit_bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references kit_bundles (id) on delete cascade,
  item_id uuid not null references inventory_items (id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 50),
  unique (bundle_id, item_id)
);

alter table kit_bundles enable row level security;
alter table kit_bundle_items enable row level security;
drop policy if exists "equipo lee paquetes" on kit_bundles;
create policy "equipo lee paquetes" on kit_bundles for select using (is_team());
drop policy if exists "staff gestiona paquetes" on kit_bundles;
create policy "staff gestiona paquetes" on kit_bundles for all using (is_staff()) with check (is_staff());
drop policy if exists "equipo lee items de paquetes" on kit_bundle_items;
create policy "equipo lee items de paquetes" on kit_bundle_items for select using (is_team());
drop policy if exists "staff gestiona items de paquetes" on kit_bundle_items;
create policy "staff gestiona items de paquetes" on kit_bundle_items for all using (is_staff()) with check (is_staff());

-- --- Convenios con coordenadas: cruza escaneos con el local -----------------
alter table benefits add column if not exists lat double precision;
alter table benefits add column if not exists lng double precision;
