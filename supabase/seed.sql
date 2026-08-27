-- ============================================================================
-- STRIDE — Migración inicial desde las planillas de Drive
-- Fuentes: "ERP STRIDE MVP" (hojas Miembros, Eventos, Tareas, Reuniones)
--          y "TAREAS TEAM STRIDE".
-- Ejecutar DESPUÉS de schema.sql.
--
-- Para el MVP solo Martín y Juanjo tienen acceso al ERP, con sus correos
-- personales. El resto del equipo queda cargado para poder asignarles tareas y
-- registrar su disponibilidad, pero SIN correo real: la planilla original traía
-- placeholders (vale@stride.cl repetido en cuatro personas, nico@stride.cl,
-- sofi@stride.cl…), que no sirven como llave de login.
--
-- Para darle acceso a alguien más: reemplaza su email PENDIENTE por el personal
-- real, crea su usuario en Supabase Auth y pega el UID en auth_user_id.
-- ============================================================================

-- --- Equipo -----------------------------------------------------------------

insert into team_members (full_name, nickname, email, phone, role, area, status) values
  ('Martín Muñoz',      'Martín', 'martin.munoz.padilla1@gmail.com', '+56973039717', 'socio',           'Dirección de Marketing y Ventas', 'activo'),
  ('Juan José Flores',  'Juanjo', 'juanjofloressv@gmail.com',        null,           'socio',           'Dirección de Operaciones',        'activo'),
  ('Nicolás',           'Nico',   'PENDIENTE-nico@stride.local',     null,           'lider_comunidad', 'Operaciones',                     'activo'),
  ('Esteban Riquelme',  'Tebo',   'PENDIENTE-tebo@stride.local',     null,           'lider_comunidad', 'Operaciones / Marketing',         'activo'),
  ('Fernanda',          'Fer',    'PENDIENTE-fer@stride.local',      null,           'lider_comunidad', 'Operaciones / Planificaciones',   'activo'),
  ('Patricio',          'Patxi',  'PENDIENTE-patxi@stride.local',    null,           'lider_comunidad', 'Operaciones / Rutas',             'activo'),
  ('Yanitze Monjes',    'Yanis',  'PENDIENTE-yanis@stride.local',    null,           'monitor',         'Operaciones',                     'activo'),
  ('Isa Molinas',       'Isa',    'PENDIENTE-isa@stride.local',      null,           'monitor',         'Operaciones',                     'activo'),
  ('Gemma',             'Gemma',  'PENDIENTE-gemma@stride.local',    null,           'monitor',         'Operaciones',                     'activo')
on conflict (email) do nothing;

-- --- Eventos históricos -----------------------------------------------------

insert into events (code, title, event_type, event_date, status, is_public, owner_id)
select v.code, v.title, v.event_type, v.event_date, v.status, false,
       (select id from team_members where nickname = v.owner)
from (values
  ('EVT-001', 'Social Run',           'social_run',           date '2026-04-11', 'completado',     'Fer'),
  ('EVT-002', 'Social Run Cafetería',  'social_run_cafeteria', date '2026-04-19', 'planificacion',  'Fer'),
  ('EVT-003', 'Social Run Sunset',     'social_run_sunset',    date '2026-04-24', 'planificacion',  'Fer')
) as v(code, title, event_type, event_date, status, owner)
on conflict (code) do nothing;

-- --- Tareas abiertas (TAREAS TEAM STRIDE) -----------------------------------

insert into tasks (title, assignee_label, assignee_id, area, priority, status, due_date)
select v.title, v.assignee,
       (select id from team_members where nickname = v.nick),
       v.area, v.priority, v.status, v.due_date
from (values
  ('Contactar a Maratón del Biobío para tickets y ofrecer activación (social run el día anterior)',
   'Martín Muñoz', 'Martín', 'Propósito, Estrategia & Dirección', 'alta',  'pendiente',   date '2026-01-15'),
  ('Armar listado de pendientes post-evento + feedback del equipo',
   'Juanjo',       'Juanjo', 'Comunidad, Operaciones & Equipo',   'media', 'recurrente',  null),
  ('Investigar posibles marcas locales para patrocinio de hidratación',
   'Martín Muñoz', 'Martín', 'Comunicación & Marca',              'media', 'pendiente',   date '2026-01-25'),
  ('Realizar encuesta rápida de satisfacción post-evento (Google Forms)',
   'Tebo',         'Tebo',   'Comunidad, Operaciones & Equipo',   'media', 'en_progreso', date '2026-01-24'),
  ('Preparar kit de primeros auxilios y checklist de seguridad para cada monitor líder',
   'Nico',         'Nico',   'Comunidad, Operaciones & Equipo',   'alta',  'pendiente',   date '2026-01-03'),
  ('Realizar video "ComeBack" Stride',
   'Esteban Riquelme', 'Tebo', 'Modelo de Negocio & Alianzas',    'media', 'en_progreso', date '2026-01-30')
) as v(title, assignee, nick, area, priority, status, due_date);

-- --- Inventario base de kits ------------------------------------------------

insert into inventory_items (name, category, size, stock, unit_cost_clp) values
  ('Polera STRIDE', 'vestuario', 'S',  0, null),
  ('Polera STRIDE', 'vestuario', 'M',  0, null),
  ('Polera STRIDE', 'vestuario', 'L',  0, null),
  ('Polera STRIDE', 'vestuario', 'XL', 0, null),
  ('Medalla',       'premio',    null, 0, 2500),
  ('Lanyard',       'kit',       null, 0, null),
  ('Sticker vinilo','kit',       null, 0, null),
  ('Bolsa',         'kit',       null, 0, null);

-- --- Testimonios ------------------------------------------------------------
--
-- Se cargan SIN publicar (published = false) a propósito: son textos de ejemplo.
-- Reemplázalos por testimonios reales de la comunidad y recién ahí pon
-- published = true. La sección no aparece en la web mientras no haya ninguno
-- publicado, así que nunca se muestra un testimonio inventado.

insert into testimonials (author_name, author_role, quote, rating, published, sort_order) values
  ('Nombre real', 'Miembro desde 2025',
   'Reemplazar por un testimonio real de la comunidad.', 5, false, 1),
  ('Nombre real', 'Social Runner',
   'Reemplazar por un testimonio real de la comunidad.', 5, false, 2),
  ('Nombre real', 'Miembro STRIDE ONE',
   'Reemplazar por un testimonio real de la comunidad.', 5, false, 3);

-- --- Convenios confirmados --------------------------------------------------
-- Los nombres están confirmados. Descuento y condiciones siguen pendientes, por
-- lo que no se publica ninguna promesa comercial hasta contar con el acuerdo.

insert into benefits (business_name, category, description, discount_label, active, sort_order) values
  ('Chile Suplementos', 'suplementacion', 'Convenio para miembros STRIDE ONE. Condiciones por confirmar.', null, true, 1),
  ('Dreams Café',       'cafeteria',      'Convenio para miembros STRIDE ONE. Condiciones por confirmar.', null, true, 2),
  ('ASICS',             'deporte',        'Convenio para miembros STRIDE ONE. Condiciones por confirmar.', null, true, 3),
  ('RideOne',           'deporte',        'Convenio para miembros STRIDE ONE. Condiciones por confirmar.', null, true, 4),
  ('Nutricionista',     'nutricion',      'Convenio para miembros STRIDE ONE. Condiciones por confirmar.', null, true, 5),
  ('Inmerso',           'bienestar',      'Convenio para miembros STRIDE ONE. Condiciones por confirmar.', null, true, 6);
