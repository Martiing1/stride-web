-- ============================================================================
-- STRIDE — Migración 010: nota de convenio solo para miembros
-- Ejecutar sobre schema.sql + 002…009.
--
-- La descripción del convenio es pública (/one la muestra a cualquiera); los
-- códigos de descuento no pueden vivir ahí. member_note se muestra únicamente
-- dentro del carnet del miembro.
-- ============================================================================

alter table benefits add column if not exists member_note text;

-- El código de Chile Suplementos pasa a la nota privada.
update benefits
set member_note = 'Tu código: STRIDE10 — úsalo al pagar en chilesuplementos.cl.'
where business_name = 'Chile Suplementos' and member_note is null;
