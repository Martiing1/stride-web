-- ============================================================================
-- STRIDE — Migración 016: Reglas vigentes y trazabilidad de decisiones
-- Ejecutar sobre schema.sql + 002…015. Aditiva.
--
-- Implementa lo que el "Libro de Actas y Gobernanza" ya manda hacer a mano:
-- registrar las decisiones de cada reunión y, en particular, los cambios al
-- Reglamento Operativo (Nivel 3). Separa dos cosas que hoy viven mezcladas:
--
--   decisions  = historia. Lo que se decidió el día X. No se toca nunca.
--   rules      = presente. Lo que rige hoy, con su historial de cambios.
--
-- Jerarquía (la fija el propio Reglamento: ante contradicción prevalece el
-- Pacto): 2 = Pacto de Socios · 3 = Reglamento Operativo · 4 = regla
-- operativa nacida de un acta.
-- ============================================================================

create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  -- Código legible y estable (R-012). Lo usa el equipo para citarla.
  code text not null unique,
  title text not null,
  -- El texto normativo. Al cambiar, la versión anterior queda en rule_changes.
  statement text not null,

  level smallint not null default 4 check (level in (2, 3, 4)),
  area text,
  -- Referencia al documento fuente cuando la regla viene del Reglamento
  -- (ej. "Anexo A · 3.4 Corrida guiada").
  source_ref text,

  -- Quién puede verla. 'equipo' = todo el team; 'socios' = solo socios;
  -- 'area' = socios + quienes trabajan esa área (líderes y monitores).
  visibility text not null default 'equipo'
    check (visibility in ('equipo', 'socios', 'area')),

  status text not null default 'vigente'
    check (status in ('vigente', 'derogada', 'propuesta')),

  origin text not null default 'acta'
    check (origin in ('reglamento', 'pacto', 'politica', 'acta', 'manual')),
  origin_doc_url text,
  -- Acta que la creó (null si viene de un documento normativo).
  origin_meeting_id uuid references meetings (id) on delete set null,

  effective_from date not null default current_date,
  -- Cuando se deroga por una regla que la reemplaza.
  superseded_by uuid references rules (id) on delete set null,
  derogated_on date,

  created_by uuid references team_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rules_vigentes on rules (status, level, area);

-- Historial: toda modificación de una regla deja rastro con su acta de origen.
create table if not exists rule_changes (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references rules (id) on delete cascade,
  change_kind text not null
    check (change_kind in ('creada', 'modificada', 'derogada', 'reactivada')),
  previous_statement text,
  new_statement text,
  reason text,
  -- Qué acta y qué decisión provocaron el cambio.
  meeting_id uuid references meetings (id) on delete set null,
  decision_id uuid references decisions (id) on delete set null,
  applied_by uuid references team_members (id) on delete set null,
  applied_at timestamptz not null default now()
);
create index if not exists idx_rule_changes_rule on rule_changes (rule_id, applied_at desc);

-- ── Decisiones: clasificación y enlace a la regla que producen ──────────────
-- 'regla'   = crea o modifica una regla vigente
-- 'puntual' = se agota al ejecutarse (un piloto, una gestión)
-- 'ninguna' = contexto, no genera obligación
alter table decisions add column if not exists classification text
  check (classification in ('regla', 'puntual', 'ninguna'));
alter table decisions add column if not exists review_status text not null default 'pendiente'
  check (review_status in ('pendiente', 'aplicada', 'descartada'));
alter table decisions add column if not exists rule_id uuid references rules (id) on delete set null;
-- Lo que propuso el análisis automático, para poder auditar sus aciertos.
alter table decisions add column if not exists proposal jsonb;

-- ── Actas: de dónde salió el documento ──────────────────────────────────────
alter table meetings add column if not exists drive_file_id text;
alter table meetings add column if not exists drive_url text;
alter table meetings add column if not exists source_project text not null default 'stride';
create unique index if not exists idx_meetings_drive on meetings (drive_file_id)
  where drive_file_id is not null;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table rules        enable row level security;
alter table rule_changes enable row level security;

drop policy if exists rules_read on rules;
create policy rules_read on rules for select
  using (is_socio() or (is_team() and visibility <> 'socios'));

drop policy if exists rules_write on rules;
create policy rules_write on rules for all
  using (is_socio()) with check (is_socio());

drop policy if exists rule_changes_read on rule_changes;
create policy rule_changes_read on rule_changes for select using (is_team());

drop policy if exists rule_changes_write on rule_changes;
create policy rule_changes_write on rule_changes for all
  using (is_socio()) with check (is_socio());

drop trigger if exists rules_touch on rules;
create trigger rules_touch before update on rules
  for each row execute function touch_updated_at();
