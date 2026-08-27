-- Ejecutar una vez si `schema.sql` ya fue aplicado antes del 27-08-2026.
-- En instalaciones nuevas estas columnas ya vienen incluidas en schema.sql.
alter table leads
  add column if not exists contact_consent boolean not null default false,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists consent_version text,
  add column if not exists consented_at timestamptz;

comment on column leads.contact_consent is
  'Autorización para responder la solicitud y contactar sobre la opción elegida.';
comment on column leads.marketing_consent is
  'Autorización opcional para novedades, actividades y comunicaciones promocionales.';
