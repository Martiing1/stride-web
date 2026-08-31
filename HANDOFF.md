# STRIDE — Estado del proyecto

> Documento de traspaso. Actualizado: **2026-08-31**.
> Lee también `README.md` (setup, marca, posicionamiento).

---

## 🟢 EN PRODUCCIÓN

**https://stridechile.cl** en línea. Auditado el 30-08: las 9 rutas públicas en 200,
las 22 del ERP protegidas (307 → login), RLS verificada (anónimos y miembros ven
cero filas internas), carnet completo probado de punta a punta, y las tres
integraciones vivas (Resend, Google Drive, Evently).

| Dominio | Qué es |
|---|---|
| `stridechile.cl` | Landing, /one, /eventos, portal de miembros |
| `admin.stridechile.cl` | ERP (mismo proyecto, middleware por host) |

---

## Arquitectura

Next.js 15 (App Router) + Tailwind + Supabase, en `/Users/martin/Documents/Stride/web`.
Un solo proyecto sirve el sitio público y el ERP.

### Web pública

| Ruta | Qué es |
|---|---|
| `/` | Landing: hero, encuentros, cómo funciona, STRIDE ONE, testimonios, captura |
| `/one` | Membresía y catálogo de convenios |
| `/eventos` | Agenda pública (evento confirmado + público + con link Evently) |
| `/miembros` | Carnet digital: QR rotativo firmado, beneficios, foto (PWA instalable) |
| `/miembros/ingresar` | Acceso del miembro: código por email o enlace, sin contraseña |
| `/auth/callback` + `/auth/enlace` | Llegada de enlaces (token_hash / PKCE / implícito) |
| `/validar/qr` | Verificación del QR rotativo + escaneo con geolocalización |
| `/tarjeta/[token]` | Redirige a /miembros/ingresar (flujo antiguo) |

### ERP — módulos

**Operaciones:** Dashboard (widgets configurables) · Tareas (lista + Kanban,
filtro propio por defecto, popup de edición completa con historial de cambios,
visibilidad solo-socios con candado y filtro, eliminar solo socios, archivo
automático de hechas +30 días) · Actas (lector del formato real, autorrelleno,
tareas editables antes de guardar con candado solo-socios por tarea)
**Social Run:** Eventos (autocompletar desde Evently, notas internas, import de
inscritos .xlsx) · Planificaciones (plantilla real por bloques, calculadora de
salidas escalonadas, checklist) · Rutas (GPX con previsualización SVG) ·
Evaluaciones (individuales y bloqueantes) · Métricas (inscritos vs asistencia,
mes a mes, quiénes más van)
**Membresía:** Plan del mes · Miembros (solo dueño; invitaciones con enlace+código)
· Escaneos (cruce con locales por coordenadas) · Convenios (CRUD + coordenadas) ·
Leads (Kanban 5 columnas + temperatura) · Testimonios (CRUD + publicar)
**Recursos:** Documentos (Drive TEAM STRIDE embebido) · Kits (CRUD, stock,
paquetes, entregas) · Finanzas (tres tipos: ingreso/costo/gasto, catálogo de categorías y
subcategorías, área de negocio por movimiento, libro diario con saldo,
presupuestos mensuales/trimestrales, churn)
**Configuración:** Equipo (CRUD + fotos) · Configuración (permisos por rol,
widgets, nombres de columnas) · Seguridad (TOTP + foto propia)

Login del equipo: email + contraseña + TOTP (se inscribe en /admin/seguridad).
Roles `socio` / `lider_comunidad` / `monitor` en dos capas: guardias en cada
página/acción **y** RLS en Postgres. La configuración de permisos solo puede
ocultar dentro de ese techo, nunca abrir más.

**Bloqueo post social run:** al día siguiente de un social run (confirmado o
completado, ventana de 14 días), el ERP de cada persona queda bloqueado hasta que
entregue SU evaluación. "No asistí" también desbloquea. Decisión de Martín, 30-08.

---

## Infraestructura

### Supabase — proyecto `stride`, ref `onljegsllbkvqbkeqbtt`

Migraciones aplicadas, en orden: `schema.sql`, `seed.sql`, `002-erp`,
`003-member-portal`, `004-erp-v2` (inscritos, evaluaciones, planificación),
`005-erp-v2-fase2` (app_settings, fotos, leads), `006-erp-v2-fase4`
(presupuestos, paquetes, coordenadas), `007-finanzas-categorias` (tipo costo,
catálogo, áreas — la vista mensual se recrea con drop, no or-replace),
`008-tareas-v2` (visibilidad solo-socios, blindada en RLS) y
`009-tareas-historial` (task_audit_log, hereda la visibilidad de la tarea).
Todas verificadas en la base.

Buckets: `rutas` (público), `comprobantes` (privado), `member-photos` (privado,
URL firmada 300 s), `team-photos` (privado, URL firmada 600 s).

Auth: SMTP propio vía Resend (smtp.resend.com, remitente
`miembros@stridechile.cl`). Plantilla del Magic Link personalizada con
`{{ .TokenHash }}` (enlace multi-dispositivo) y `{{ .Token }}` (código). Site URL
`https://stridechile.cl`; redirect list incluye `/auth/callback`, `/**` y
`localhost:3000/**`. La tabla `fincore_leads` es de otro proyecto: **no tocar.**

### Vercel — proyecto `stride-web`

Deploy: `cd web && npx vercel deploy --prod`. El código vive en GitHub
`Martiing1/stride-web` (main = ERP; la landing vieja quedó en la rama
`landing-antigua`), pero Vercel está DESCONECTADO del repo a propósito: el
deploy es siempre manual desde la carpeta local. El keychain local autentica
como `fincore08-ai` (solo lectura): para push se usa un token temporal de
Martiing1 que se revoca después. Variables en Production y Preview: las de Supabase +
`RESEND_API_KEY`, `LEADS_NOTIFY_FROM/TO`, `QR_SIGNING_SECRET`,
`GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`, `GOOGLE_DRIVE_ROOT_FOLDER`.
Ojo: `QR_SIGNING_SECRET` de producción y el local son distintos a propósito
(un QR generado local no valida en prod).

### Google Drive

OAuth de `martin.munoz.padilla1@gmail.com` (proyecto GCP `stridechile-admin`,
app "Stride-erp" **publicada en producción** — si vuelve a "prueba", el refresh
token muere cada 7 días). Scope `drive`. El módulo Documentos solo navega el
árbol de la carpeta `TEAM STRIDE` (`GOOGLE_DRIVE_ROOT_FOLDER`); estructura
creada el 30-08: Eventos/2026 (con las fotos del Starbucks), Marketing y
Contenido, Convenios y Alianzas, Finanzas, Equipo, Plantillas, más subcarpetas
en Planificaciones, rutas y Reuniones Equipo (Actas 2026).

### Evently

Sin API. El autocompletado de eventos lee el JSON-LD (schema.org/Event) de la
página pública del evento — título, fecha/hora (UTC→Chile), lugar, descripción.
Cupos no existe en la página: va a mano. El export de inscritos (.xlsx) se sube
en la ficha del evento; la columna "Fecha de Validación" es el check-in en
puerta y alimenta Métricas y el widget de asistencia del dashboard.

---

## Qué falta (todo del lado de contenido/operación)

1. **Accesos del equipo: 2 de 9** (Martín y Juanjo, ambos socios). Los 7
   `PENDIENTE-*@stride.local` necesitan correo real (Equipo lo edita) + usuario
   en Supabase Auth + UID en `team_members.auth_user_id`. El flujo de estreno:
   contraseña temporal por WhatsApp → Seguridad → cambiar contraseña + TOTP.
2. **Miembros reales: 0.** Solo "Miembro de prueba" (vence 2026-08-31). El alta
   real: Miembros → Nuevo → Enviar invitación (sale por Resend con enlace+código).
3. **Convenios:** los 6 sin coordenadas (pegar link de Maps en cada uno para el
   cruce de escaneos) y con descripción genérica.
4. **Testimonios:** 3 borradores, 0 publicados. La landing no muestra la sección.
5. **Eventos:** ninguno público con link de Evently; el próximo social run
   conviene crearlo con "Autocompletar" y publicarlo.
6. **Inscritos:** 0 importados — subir el .xlsx del Starbucks 30-08 (149/73)
   para estrenar Métricas.
7. **v3 pendiente de diseño:** testimonios en video, CRM de alianzas (planilla
   "Carreras STRIDE"), módulo de marketing/contenidos.

## Decisiones que NO hay que revertir

1. QR de miembros sin escáner (cámara nativa) y **rotativo**: token HMAC por
   ventana de 5 min + 5 de gracia (`QR_GRACE_SECONDS`) — sin gracia, un QR
   abierto al final de una ventana vivía segundos.
2. La landing no vende la membresía; STRIDE ONE es mindset, no producto deportivo.
3. Nada de urgencia inventada (cupos solo con número real; testimonios solo publicados).
4. Degradado cian→indigo→morado; morado sólido solo en botones.
5. El cobro vive en Skool; sin pasarela ni link público a Skool.
6. Los responsables compuestos de actas quedan sin asignar a propósito.
7. La membresía la administra **solo el dueño** (`is_stride_owner()` en RLS).
8. Evaluación post social run individual y bloqueante, con ventana de 14 días.
9. Documentos = Drive real (no Storage), acotado al árbol TEAM STRIDE.

## Trampas conocidas

- **El acta real no trae AUTO_PROCESSING**: formato "ERP/OS" (`NUEVA | …` +
  secciones numeradas). `lib/acta-parser.ts` soporta ambos; probado con el acta
  de julio (7 tareas, 9 decisiones, 5 seguimientos, 0 warnings).
- **El enlace de acceso vuelve de tres formas** (token_hash / PKCE / fragmento
  implícito). `/auth/callback` atiende las tres; `AuthHashCatcher` rescata
  tokens que aterrizan en la portada. El enlace y el código son el mismo token:
  usar uno consume el otro, y solo vive el último correo pedido.
- **`members` es solo del dueño** desde la migración 003: cualquier página del
  ERP que la lea con sesión normal recibe cero filas sin error. Kits, escaneos,
  finanzas y dashboard usan el cliente de servicio tras verificar el permiso.
- **member_code usa alfabeto sin 0/1/I/L/O**; un código fuera de ese juego no
  valida jamás (pasó con STR-TEST01).
- **Deploy Vercel BLOCKED**: el motivo real está en `readyStateReason` de la API
  (histórico: autor git sin acceso al team).
- **No correr `next build` con el dev server arriba** (se pisan en `.next`).
- **`/admin/login` y `/admin/activar` heredan el layout del ERP**: el middleware
  manda `x-stride-pathname` (ya reescrito en el host admin) y el layout los
  excluye antes de exigir sesión.
- **Sourcing de `.env.local` en shell se corta** en `LEADS_NOTIFY_FROM=STRIDE <…>`
  (el `<` rompe al shell): para scripts, extraer con `grep`, no con `source`.
- **Tildes corruptas del seed** (UTF-8 leído como Mac Roman, se ve `√≥`):
  reparadas el 30-08; si aparece otra `√`, es lo mismo.

## Piezas que vale la pena conocer

- `lib/acta-parser.ts` — ambos formatos de acta + encabezado para autorrelleno.
- `lib/rotating-qr.ts` + `lib/codes.ts` — QR rotativo firmado y códigos de miembro.
- `lib/evaluations.ts` — la puerta del bloqueo post social run.
- `lib/app-settings.ts` (+`-server`) — registro de módulos, permisos por rol,
  widgets; consumido por sidebar, dashboard y configuración.
- `lib/google-drive.ts` — cliente REST mínimo de Drive (token cacheado).
- `lib/evently.ts` — lector de JSON-LD de eventos de Evently (solo evently.cl).
- `lib/xlsx-lite.ts` — lector de .xlsx sin dependencias (ZIP+XML a mano) para
  el import de inscritos.
- `components/admin/PlanStructureEditor.tsx` — plantilla del social run y
  calculadora de salidas escalonadas (cada grupo con su pace y descanso).
- `generate_month_checklist(date)` / `monthly_finance_summary` — SQL de membresía
  y finanzas.
