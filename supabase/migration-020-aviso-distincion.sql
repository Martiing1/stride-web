-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 020 · La campana acepta avisos de distinción
-- Aditiva y segura de re-ejecutar.
--
-- `notifications.kind` tenía una lista cerrada sin 'distincion', así que el
-- aviso del Nº1 del mes se caía en silencio (el insert fallaba y solo quedaba
-- en el log). Con esto la corona sí avisa por la campana.
-- ─────────────────────────────────────────────────────────────────────────────
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('general', 'comment', 'like', 'medal', 'points', 'event', 'reto', 'pausa', 'distincion'));
