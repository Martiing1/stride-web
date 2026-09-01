-- ═════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 014 · Club de lectura (01-09-2026)
-- Nuevo tipo de evento para el calendario de miembros: sesión del club de
-- lectura. Los tipos antiguos se mantienen en el check por las filas históricas.
-- Aditiva: se puede correr las veces que sea.
-- ═════════════════════════════════════════════════════════════════════════════

alter table events drop constraint if exists events_event_type_check;
alter table events add constraint events_event_type_check
  check (event_type in ('social_run', 'social_run_cafeteria', 'social_run_sunset',
                        'marca', 'retiro', 'race_trip', 'sesion_online',
                        'club_lectura', 'otro'));
