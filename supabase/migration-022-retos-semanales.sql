-- ─────────────────────────────────────────────────────────────────────────────
-- 022 · Micro-retos que se reinician cada semana
-- ─────────────────────────────────────────────────────────────────────────────
-- Hasta ahora el avance de un reto era único por (reto, miembro): un 3/3 de la
-- primera semana quedaba pegado todo el mes y nadie podía registrar la
-- segunda. Se agrega la semana (lunes, hora Chile) a la clave. Los retos que
-- no son semanales usan la fecha centinela 1970-01-01.
--
-- PASO 1 — correr ANTES del deploy (el código viejo sigue funcionando).
alter table challenge_progress
  add column if not exists week_start date not null default '1970-01-01';

-- Lo ya avanzado en micro-retos queda en la semana en que se registró.
update challenge_progress p
   set week_start = date_trunc('week', (p.updated_at at time zone 'America/Santiago'))::date
  from challenges c
 where c.id = p.challenge_id
   and c.period = 'semana'
   and p.week_start = '1970-01-01';

create unique index if not exists idx_cprogress_unique
  on challenge_progress (challenge_id, member_id, week_start);

-- De paso: el import de Evently no tenía candado por (evento, email), así que
-- un archivo con filas repetidas dejaba asistentes duplicados. Se limpian
-- (se conserva la fila enlazada a miembro o, si no, la más antigua) y se
-- cierra con un índice único parcial.
with ranked as (
  select id,
         row_number() over (
           partition by event_id, attendee_email
           order by (member_id is not null) desc, created_at, id
         ) as rn
    from event_attendance
   where attendee_email is not null
)
delete from event_attendance where id in (select id from ranked where rn > 1);

create unique index if not exists idx_attendance_email
  on event_attendance (event_id, attendee_email) where attendee_email is not null;

-- PASO 2 — correr DESPUÉS del deploy (el código nuevo ya escribe por semana).
-- alter table challenge_progress
--   drop constraint if exists challenge_progress_challenge_id_member_id_key;
