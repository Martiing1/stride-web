-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 018 · Unidad del autoreporte en los retos
-- Aditiva y segura de re-ejecutar.
--
-- Los retos de criterio "cantidad" se registran con un botón "+1". Hasta ahora
-- ese botón siempre decía "entrenamiento", que solo calza con los retos de
-- correr. Con `unit` cada reto nombra lo que se registra (avance, foto, paso…).
-- Null = "entrenamiento", así los retos que ya existen no cambian.
-- ─────────────────────────────────────────────────────────────────────────────
alter table challenges add column if not exists unit text;
