-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 019 · Distinción "Voz del mes"
-- Aditiva y segura de re-ejecutar.
--
-- Quienes más comentaron en un mes lucen una insignia junto a su nombre
-- durante el mes siguiente. Se calcula una sola vez por mes (en la primera
-- lectura del mes, a partir de community_comments del mes anterior) y se
-- guarda acá para que quede el historial y para poder avisarles una sola vez.
--   month  = primer día del mes en que SE LUCE la insignia.
--   score  = comentarios hechos en el mes medido (el anterior).
-- Solo la lee/escribe el servidor con service role: RLS activa sin políticas.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists community_distinctions (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  kind text not null default 'voz_del_mes',
  member_id uuid not null references members (id) on delete cascade,
  rank int not null,
  score int not null,
  created_at timestamptz not null default now(),
  unique (month, kind, member_id)
);
create index if not exists idx_cdistinctions_month on community_distinctions (month, kind);
alter table community_distinctions enable row level security;
