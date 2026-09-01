# Migración 012 · Comunidad de miembros — 1 paso

La comunidad (`stridechile.cl/miembros`) ya está programada, pero sus tablas
viven en `supabase/migration-012-comunidad.sql` y **hay que ejecutarla una vez**
(no pude hacerlo yo: el proyecto no expone la conexión directa a Postgres, solo
las API keys).

## El paso

1. Abre el **SQL Editor** de tu proyecto en [supabase.com](https://supabase.com/dashboard).
2. Copia TODO el contenido de `web/supabase/migration-012-comunidad.sql`.
3. Pégalo y presiona **Run**.

Listo. Es **100% aditiva**: crea tablas nuevas, buckets y políticas; no toca
ninguna tabla ni dato existente (members, events, scans, etc. quedan igual).
Se puede ejecutar dos veces sin romper nada (todo es `if not exists` /
`on conflict do nothing`).

## Qué se activa al correrla

- Blog (posts, comentarios, likes, canales, fijados)
- Hábitos (máx. 4, privados) + rachas con pausas protegidas
- Retos (mes / micro / generales / hitos) + verificación
- Medallas (catálogo seed + físicas con foto)
- Puntos y ranking mensual (pesos configurables en ERP → Comunidad → Puntos)
- RSVP + asistencia importada de Evently (ERP → Comunidad → Asistencia)
- Notificaciones (campana), Classroom (etapas drip + planes seed)

Sin la migración, el área de miembros **no se cae**: muestra estados vacíos
(los queries pasan por `safeQuery`). El carnet y el QR funcionan igual que
siempre.

## Después de correrla (opcional, 2 min)

- ERP → **Comunidad → Retos**: revisa los 4 retos seed de septiembre.
- ERP → **Comunidad → Puntos**: ajusta los pesos si quieres.
- ERP → **Eventos**: para una sesión online, crea el evento con tipo
  `sesion_online` y pega el link de Meet en la columna `meet_url`
  (por ahora vía SQL o Supabase Table Editor; el formulario del ERP aún no
  tiene ese campo — está anotado como pendiente).
