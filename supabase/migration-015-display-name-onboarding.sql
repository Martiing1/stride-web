-- ═════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 015 · Nombre para mostrar + recorrido de bienvenida (01-09-2026)
-- display_name: cómo quiere aparecer el miembro en la comunidad (Blog, Ranking,
--   comentarios). full_name sigue siendo el nombre real del ERP y del carnet.
-- onboarding_done_at: cuándo terminó (o saltó) el recorrido del primer ingreso.
-- Aditiva: se puede correr las veces que sea.
-- ═════════════════════════════════════════════════════════════════════════════

alter table members add column if not exists display_name text;
alter table members add column if not exists onboarding_done_at timestamptz;
