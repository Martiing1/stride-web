-- ============================================================================
-- STRIDE — Migración 007: costos, catálogo de categorías y áreas en finanzas
-- Ejecutar sobre schema.sql + 002…006.
--
-- Distingue COSTO (lo que cuesta producir el servicio: premios, hidratación,
-- kits) de GASTO (operar: software, comisiones), agrega un catálogo de
-- categorías con subcategorías, y anexa cada movimiento a un área del negocio
-- (membresía, social run, marketing…).
-- ============================================================================

-- --- Transacciones: tipo 'costo', subcategoría y área -----------------------
alter table transactions drop constraint if exists transactions_kind_check;
alter table transactions add constraint transactions_kind_check
  check (kind in ('ingreso', 'costo', 'gasto'));

alter table transactions add column if not exists subcategory text;
alter table transactions add column if not exists area text not null default 'general'
  check (area in ('general', 'membresia', 'social_run', 'marketing', 'alianzas', 'operacion'));

-- --- Presupuestos también entienden 'costo' ---------------------------------
alter table budgets drop constraint if exists budgets_kind_check;
alter table budgets add constraint budgets_kind_check
  check (kind in ('ingreso', 'costo', 'gasto'));

-- --- Catálogo de categorías y subcategorías ---------------------------------
create table if not exists finance_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ingreso', 'costo', 'gasto')),
  name text not null,
  parent_id uuid references finance_categories (id) on delete cascade,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_finance_categories_unique
  on finance_categories (kind, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

alter table finance_categories enable row level security;
drop policy if exists "socios gestionan categorias" on finance_categories;
create policy "socios gestionan categorias"
  on finance_categories for all using (is_socio()) with check (is_socio());

-- --- La vista mensual aprende a separar costos ------------------------------
create or replace view monthly_finance_summary as
select
  date_trunc('month', occurred_on)::date                        as month,
  sum(amount_clp) filter (where kind = 'ingreso')               as ingresos,
  sum(amount_clp) filter (where kind = 'costo')                 as costos,
  sum(amount_clp) filter (where kind = 'gasto')                 as gastos,
  coalesce(sum(amount_clp) filter (where kind = 'ingreso'), 0)
    - coalesce(sum(amount_clp) filter (where kind = 'costo'), 0)
    - coalesce(sum(amount_clp) filter (where kind = 'gasto'), 0) as resultado,
  count(*)                                                      as movimientos
from transactions
group by 1
order by 1 desc;

-- --- Catálogo inicial (editable después desde el ERP) -----------------------
do $$
declare cat_id uuid;
begin
  if not exists (select 1 from finance_categories) then
    insert into finance_categories (kind, name, sort_order) values ('ingreso', 'Membresías', 0) returning id into cat_id;
    insert into finance_categories (kind, name, parent_id) values ('ingreso', 'STRIDE ONE', cat_id);
    insert into finance_categories (kind, name, sort_order) values ('ingreso', 'Colaboraciones y sponsors', 1);
    insert into finance_categories (kind, name, sort_order) values ('ingreso', 'Otros ingresos', 2);

    insert into finance_categories (kind, name, sort_order) values ('costo', 'Eventos', 0) returning id into cat_id;
    insert into finance_categories (kind, name, parent_id) values ('costo', 'Premios y sorteos', cat_id);
    insert into finance_categories (kind, name, parent_id) values ('costo', 'Hidratación y frutas', cat_id);
    insert into finance_categories (kind, name, parent_id) values ('costo', 'Materiales y logística', cat_id);
    insert into finance_categories (kind, name, sort_order) values ('costo', 'Kits', 1) returning id into cat_id;
    insert into finance_categories (kind, name, parent_id) values ('costo', 'Poleras', cat_id);
    insert into finance_categories (kind, name, parent_id) values ('costo', 'Merch y stickers', cat_id);

    insert into finance_categories (kind, name, sort_order) values ('gasto', 'Operación', 0) returning id into cat_id;
    insert into finance_categories (kind, name, parent_id) values ('gasto', 'Software y dominios', cat_id);
    insert into finance_categories (kind, name, parent_id) values ('gasto', 'Comisiones y banco', cat_id);
    insert into finance_categories (kind, name, sort_order) values ('gasto', 'Marketing', 1);
    insert into finance_categories (kind, name, sort_order) values ('gasto', 'Equipo', 2);
  end if;
end $$;
