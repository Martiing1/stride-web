# STRIDE — Estado del proyecto y qué sigue

> Documento de traspaso. Actualizado: 2026-08-27.
> Lee también `README.md` (setup, marca, posicionamiento).

---

## Qué está hecho

Proyecto Next.js 15 (App Router) + Tailwind + Supabase en `/web`.
**Build limpio, typecheck sin errores.**

Un solo proyecto sirve el sitio público y el ERP: `middleware.ts` detecta el host
`admin.` y reescribe a `/admin/*`.

### Web pública

| Ruta | Estado |
|---|---|
| `/` | Hero con foto + slogan, agenda, cómo funciona, STRIDE ONE, testimonios, captura |
| `/one` | Membresía, 4 pilares, catálogo de convenios, CTA al formulario/WhatsApp |
| `/eventos` | Agenda de Social Runs con link de Evently por evento |
| `/tarjeta/[token]` | Tarjeta virtual del miembro con QR (link privado) |
| `/validar/[code]` | Verificación pública para comercios + registro de escaneo con geo |

### ERP (`admin.stridechile.cl`)

Login email + password + **TOTP**. Roles: `socio` / `lider_comunidad` / `monitor`.

`/admin` (dashboard) · `/admin/tareas` · `/admin/actas` (+ `/nueva`, `/[id]`) ·
`/admin/eventos` (+ `/[id]` con encuesta de disponibilidad) · `/admin/miembros` ·
`/admin/escaneos` · `/admin/convenios` · `/admin/leads` · `/admin/kits` ·
`/admin/finanzas` · `/admin/equipo`

Permisos en dos capas: `requireTeamMember()` en cada página **y** políticas RLS en
Postgres. Si alguien saltara la primera, la base rechaza la consulta igual.

### Piezas que valen la pena conocer

- **`lib/acta-parser.ts`** — parsea el bloque `AUTO_PROCESSING` de las actas y crea
  tareas, decisiones y seguimientos. **Verificado contra un acta real**: 7 tareas,
  9 decisiones, 5 seguimientos, 0 errores. Los responsables compuestos
  ("Nicolás / Fernanda") quedan sin asignar a propósito.
- **`lib/codes.ts`** — genera `member_code` (público, va en el QR) y `card_token`
  (secreto, es el link de la tarjeta).
- **`lib/dev-placeholders.ts`** — datos de muestra que corren **solo** si la base
  vino vacía y `NODE_ENV !== "production"`.
- **`supabase/schema.sql`** — 14 tablas, 1 vista, RLS completo.
- **`supabase/seed.sql`** — migración del equipo, tareas y eventos desde las
  planillas de Drive.

---

## Qué falta (en orden)

### 1. Supabase — conectado el 27-08-2026

- Proyecto activo: `stride` (`onljegsllbkvqbkeqbtt`) en la organización
  `martin's projects`.
- `supabase/schema.sql` y `supabase/seed.sql` ejecutados correctamente.
- Conteos verificados: 9 integrantes, 3 eventos, 6 convenios, 3 testimonios y
  6 tareas.
- `.env.local` conectado con URL, clave pública y clave de servidor. Las claves
  no se documentan ni se suben al repo.
- La tabla preexistente `fincore_leads` pertenece a otro flujo y no fue alterada.
- Conexión real verificada desde la app consultando los 6 convenios con la clave
  pública y RLS activo.

### 2. Datos reales

| Qué | Dónde | Detalle |
|---|---|---|
| WhatsApp e Instagram | `lib/site.ts` | Confirmados y cargados |
| Emails del equipo | tabla `team_members` | 7 personas con `PENDIENTE-`; la planilla original tenía placeholders duplicados |
| Convenios | tabla `benefits` | 6 nombres confirmados; faltan descuentos y condiciones reales |
| Testimonios | tabla `testimonials` | Cargados con `published = false`; reemplazar y publicar |
| Cupos por evento | `events.spots_left` | Se carga a mano; sin número no se muestra badge de urgencia |

#### Confirmado el 27-08-2026

- WhatsApp público: `+56 9 3480 6986`.
- Instagram: `@stridechile`.
- Cifras del hero: `+200` miembros, `+100` eventos y `2 años`.
- Convenios confirmados por nombre: Chile Suplementos, Dreams Café, ASICS,
  RideOne, Nutricionista e Inmerso. Descuentos y condiciones aún pendientes.
- No se enlazará públicamente a Skool; la captación va al formulario/WhatsApp.
- **Postergado hasta editar el módulo admin:** cargar eventos y testimonios reales.
  No cerrar ni publicar esos contenidos directamente desde el código.

### 3. Accesos al ERP

Solo Martín y Juanjo en el MVP, con sus correos personales
(`martin.munoz.padilla1@gmail.com`, `juanjofloressv@gmail.com`):

**Martín — acceso preparado el 27-08-2026:** usuario Auth creado, UID enlazado a
su fila activa con rol `socio` y correo de recuperación enviado. La ruta pública
`/admin/activar` recibe la sesión de recuperación y permite crear la contraseña.
Juanjo continúa pendiente y no ha recibido invitación.

```
1. Supabase → Authentication → Users → crear usuario con email y password
2. Copiar el User UID → pegarlo en team_members.auth_user_id de su fila
3. En el primer login, cada uno inscribe su app autenticadora (TOTP)
```

### 3b. Módulos del ERP — agregados el 27-08-2026

`supabase/migration-002-erp.sql` **ya ejecutado** (tablas `routes`, `event_plans`,
`membership_checklist_templates`, `membership_month_items`, columnas nuevas en
`transactions` y `events`, vista `monthly_finance_summary`, buckets `rutas` y
`comprobantes`).

Navegación reorganizada en cuatro secciones: **Operaciones**, **Social Run**,
**Membresía** y **Recursos**.

| Módulo | Estado |
|---|---|
| Leads en Kanban + alta manual | Listo |
| Plan del mes de la membresía (checklist editable) | Listo |
| Social Run › Planificaciones (formulario estructurado) | Listo |
| Social Run › Rutas (GPX + link + seguridad) | Listo |
| Finanzas (CRUD, comprobantes, balance, proyección) | Listo |
| **Kits e inventario — solo lectura, falta CRUD** | Pendiente |
| Gestión de convenios y testimonios desde el ERP | Pendiente (hoy se editan en Supabase) |

### 4. Deploy

Hecho el 27-08-2026:

- Git inicializado con un commit; `.env.local` verificado fuera del control de versiones.
- Proyecto local enlazado a `stride-web` (`vercel link`).
- **`framework` corregido de `null` a `nextjs`** — estaba configurado como sitio
  estático, por eso los builds no arrancaban nunca.
- **`.vercelignore` creado** — sin él el CLI intentaba subir los 478 MB de
  `node_modules` y el deploy se colgaba.
- Las 4 variables de entorno cargadas en Production, Preview y Development.
  `SUPABASE_SERVICE_ROLE_KEY` existe solo en Production y Preview, como *Secret*.
- **Repo `Martiing1/stride-web` DESCONECTADO** del proyecto Vercel, por orden
  expresa de Martín: la landing antigua no debe volver a desplegarse. Lo que se
  publica es la carpeta local.
- Los tres dominios agregados y **verificados** (`verified: true`).

**BLOQUEADO:** los tres deployments quedan en estado `BLOCKED`. No es el código
—compila local sin errores— sino la cuenta: plan **Hobby**, solo 3 deploys en 24 h
y cero cuota consumida. La hipótesis es la detección de uso comercial de Vercel
(la cuenta tiene FinCore, Norte y Stride). El motivo exacto solo se lee entrando
al deployment en el panel; la API no lo expone.

El aviso "DNS Change Recommended" de los dominios NO es un error: Vercel prefiere
su IP nueva para el registro A, pero `76.76.21.21` funciona.

### 5. v2 — no empezado

- **Autocompletar evento desde el link de Evently.** Hoy pegas el link y se guarda
  tal cual; los demás campos van a mano. Se podría leer los metadatos del link para
  prellenar título e imagen (fecha y hora quizás; cupos y punto de encuentro casi
  seguro que no, sin API de Evently).
- **Testimonios en video** — reemplazan al carrusel actual. Hay un `TODO` en
  `components/Testimonials.tsx`.
- Gestión de testimonios y convenios desde el ERP (hoy se editan en Supabase).
- CRM de alianzas y sponsors (existe la base en el Sheet "Carreras STRIDE").
- Módulo de marketing y contenidos.

---

## Decisiones que NO hay que revertir

Están tomadas con razón; si algo se cambia, que sea a propósito.

1. **El QR no necesita escáner.** Contiene la URL completa; el comercio usa la
   cámara nativa de su celular. Se descartó `html5-qrcode` deliberadamente.
2. **La landing no es una página de venta de la membresía.** El core es la
   comunidad y los Social Runs gratuitos. STRIDE ONE entra como "el siguiente
   paso", después de los testimonios. Orden: Hero → Encuentros → Cómo funciona →
   STRIDE ONE → Testimonios → Captura.
3. **STRIDE ONE se vende como mindset y constancia**, no como producto deportivo.
   Correr es la excusa.
4. **Nada de urgencia inventada.** El badge de cupos solo aparece con un número
   real cargado; los testimonios solo si están publicados.
5. **El degradado va cian `#00E5FF` → indigo `#6366F1` → morado `#7C3AED`.** El
   logo original llega hasta magenta puro, pero se cortó antes: Martín pidió bajarle
   al rosado. El morado sólido queda solo para botones (contraste).
6. **La membresía se cobra en Skool.** No hay pasarela de pago en la web.

---

## Trampas conocidas

- **`/admin/login` también hereda `app/admin/layout.tsx`.** Un layout hijo no
  reemplaza al padre en App Router. El middleware entrega `x-stride-pathname` y
  el layout padre excluye explícitamente el login antes de exigir sesión; quitar
  esa exclusión vuelve a provocar `ERR_TOO_MANY_REDIRECTS`.
- **No correr `next build` con el dev server arriba.** Ambos escriben en `.next` y
  se pisan; el dev server queda tirando 500. Si pasa: detener, `rm -rf .next`,
  reiniciar.
- **Fondos con `-z-10` desaparecen** detrás del color del `body`. Usar `z-0` en el
  fondo y `relative z-10` en el contenido.
- **`text-shadow` sobre texto con `bg-clip-text`** se ve *a través* de las letras y
  ensucia el degradado. Usar `drop-shadow` en su lugar.
- **`public/` creada después de arrancar el server** no se sirve hasta reiniciar.
