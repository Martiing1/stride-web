# Incidente de accesos de equipo — 2026-09-01

## Severidad

Alta. Una invitación al ERP podía terminar en `/miembros` y mostrar controles de
administración de comunidad a un Líder de Comunidad.

## Diagnóstico confirmado

1. La invitación del equipo redirige a `/admin/activar` para que la persona cree
   una contraseña.
2. El componente global `AuthHashCatcher` interceptaba los tokens de ese enlace
   antes de que llegaran a la pantalla de activación y los enviaba a
   `/auth/enlace` sin conservar el destino.
3. Ese flujo usa por defecto `/miembros`, por lo que al recargar podía terminar
   en el portal de miembros.
4. `getCommunityStaff` consideraba a `lider_comunidad` como administrador del
   portal de miembros. Por eso ese rol podía ver controles de publicación,
   retos, calendario y classroom destinados a socios.

## Trabajo realizado antes de detectar el incidente

- Se agregó desde Admin → Equipo el botón para crear/vincular una cuenta y
  enviar la invitación de acceso.
- Se agregó la previsualización de permisos por rol en Configuración.
- Los cambios fueron compilados y desplegados en producción.

## Corrección implementada y verificada localmente

- `/admin/activar` queda excluido del capturador global de tokens para que su
  propia pantalla cree la contraseña.
- Cualquier otro enlace conserva su destino; no cae por defecto en `/miembros`.
- El modo administrador de `/miembros` queda limitado exclusivamente a `socio`.
- Líderes y monitores ya no ven el enlace directo "Vista Miembros" en el ERP.
- `npm run build` terminó correctamente.

## Siguiente paso operativo

1. Desplegar esta corrección en producción.
2. Desde Admin → Equipo, usar **Reenviar acceso** para cada persona que recibió
   el enlace anterior. El nuevo enlace abre la activación, donde crea su
   contraseña.
3. La persona entra después por `admin.stridechile.cl` con ese correo y
   contraseña; el segundo factor se configura dentro del ERP.

## Regla de acceso resultante

| Rol | ERP | Administración del portal `/miembros` |
|---|---|---|
| Socio | Sí, según sus permisos | Sí |
| Líder de Comunidad | Sí, según sus permisos | No |
| Monitor | Sí, según sus permisos | No |
| Miembro | No | No |

> Tener una cuenta en Supabase Auth no concede acceso a ningún área por sí solo.
> El ERP depende de `team_members` activo; el portal de miembros depende de
> `members`; y la administración del portal queda reservada a socios.
