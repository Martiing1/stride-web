-- ============================================================================
-- STRIDE — Migración 013: ajustes de la comunidad (feedback 01-09)
-- Ejecutar después de la 012. Aditiva e idempotente.
--  1. Respuestas a comentarios (hilos de 1 nivel)
--  2. Nota personal en las medallas ("inmortalizar el momento")
-- ============================================================================

alter table community_comments
  add column if not exists parent_id uuid references community_comments (id) on delete cascade;

create index if not exists idx_ccomments_parent on community_comments (parent_id);

alter table member_medals
  add column if not exists note text;
