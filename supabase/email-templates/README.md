# Plantillas de correo de Supabase Auth

Estos correos **no salen del código de la app**: los envía Supabase Auth con la
plantilla guardada en su configuración, por SMTP de Resend
(`miembros@stridechile.cl`). Por eso, editar `lib/resend.ts` no los cambia.

| Plantilla | Cuándo se envía | A quién | Destino del botón |
|---|---|---|---|
| `magic_link` | Alguien pide su código en `/miembros/ingresar` | Miembros | `/miembros` |
| `confirmation` | Confirmación de correo | Miembros | `/miembros` |
| `invite` | El ERP invita a alguien del equipo (`inviteUserByEmail`) | Equipo | `/admin/activar` |
| `recovery` | El ERP reenvía acceso o se renueva contraseña | Equipo | `/admin/activar` |

El correo de **bienvenida** de un miembro activado es otro camino: lo manda la
app con Resend (`lib/resend.ts` → `memberAccessEmailHtml`), y ese sí se edita
en el código.

## Cómo actualizarlas

`generar-plantillas.py` arma el HTML (mismo marco visual que `lib/resend.ts`).
Para publicarlas, se envían con la Management API usando el token de
`.env.local`:

```
PATCH https://api.supabase.com/v1/projects/<ref>/config/auth
{ "mailer_subjects_<tpl>": "...", "mailer_templates_<tpl>_content": "<html>" }
```

Variables disponibles en la plantilla: `{{ .SiteURL }}`, `{{ .TokenHash }}`,
`{{ .Token }}`, `{{ .Email }}`. El enlace usa `token_hash` a propósito: es el
único formato que funciona cuando el correo se abre en otro navegador o dentro
del visor de Gmail (ver el comentario de `app/auth/callback/route.ts`).
