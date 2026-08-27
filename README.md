# STRIDE — Plataforma web + ERP

Next.js 15 (App Router) + Tailwind + Supabase. Un solo proyecto sirve el sitio
público (`stridechile.cl`) y el ERP interno (`admin.stridechile.cl`).

---

## Puesta en marcha

### 1. Supabase

Crea el proyecto en [supabase.com](https://supabase.com) y en el **SQL Editor** corre,
en este orden:

1. `supabase/schema.sql` — tablas, vistas, funciones y políticas RLS.
2. `supabase/seed.sql` — migración del equipo, tareas abiertas, eventos e inventario
   desde las planillas de Drive.

> El seed trae emails de ejemplo (`nico@stridechile.cl`, etc.) porque la planilla
> original los tenía como placeholders. **Corrígelos antes de dar acceso**: el email
> es la llave del login.

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y complétalo:

| Variable | Dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (**secreta**, nunca en el cliente) |
| `RESEND_API_KEY` | [resend.com](https://resend.com), para avisar los leads por email |
| `LEADS_NOTIFY_TO` | `martin@stridechile.cl,juanjose@stridechile.cl` |
| `LEADS_NOTIFY_FROM` | Un remitente del dominio verificado en Resend |
| `NEXT_PUBLIC_SITE_URL` | `https://stridechile.cl` |

### 3. Datos de contacto

En `lib/site.ts` están centralizados el WhatsApp y el Instagram públicos. La web
no enlaza directamente a Skool: los CTA de captación llevan al formulario o a
WhatsApp.

---

## Marca

El logo oficial (`stride_logo.png`) va de cian a magenta puro. El degradado de la
web se corta antes del rosado:

```
#00E5FF  →  #6366F1  →  #7C3AED
  cian       indigo      morado
```

Se aplica con la clase `.wordmark` (texto) o `.gradient-surface` (fondos), en
`app/globals.css`. El morado sólido `#7C3AED` queda para botones y CTAs: los
extremos del degradado no dan contraste suficiente con texto blanco.

## Posicionamiento

STRIDE ONE **no se vende como producto deportivo**. Se vende como constancia,
hábitos y desarrollo personal — correr es la excusa. Por eso:

- La pregunta principal del formulario es la **motivación**, no el nivel de running.
- El nivel de running es opcional y solo sirve para armar grupos de ritmo.
- El copy de `/one` habla de sostener el hábito, no de mejorar marcas.

Pero la landing **no es una página de venta de la membresía**. El core es la
comunidad y los Social Runs gratuitos; STRIDE ONE aparece como "el siguiente
paso", después de que la persona ya entendió de qué se trata. El orden de la
landing es deliberado:

```
Hero (slogan + foto)  →  Próximos encuentros  →  Cómo funcionan
   →  Testimonios  →  STRIDE ONE  →  Captura de leads
```

## Cosas que necesitan contenido real

| Qué | Dónde | Estado |
|---|---|---|
| Foto del hero | `public/hero.jpg` | Listo (foto grupal de Social Run) |
| Testimonios | tabla `testimonials` | Cargados sin publicar; reemplazar y poner `published = true` |
| WhatsApp e Instagram | `lib/site.ts` | Confirmados |
| Números del hero | `lib/site.ts` → `stats` | Confirmados: +200, +100 y 2 años |
| Convenios | tabla `benefits` | 6 nombres confirmados; faltan descuentos y condiciones |
| Emails del equipo | tabla `team_members` | 7 personas con `PENDIENTE-` |

La sección de testimonios **no se renderiza** mientras no haya ninguno publicado,
y el aviso de cupos solo aparece si `spots_left` tiene un número cargado: nada de
urgencia inventada.

### Datos de muestra en desarrollo

Mientras Supabase no esté conectado, `npm run dev` muestra eventos y testimonios
de ejemplo (`lib/dev-placeholders.ts`) para poder revisar el diseño. Se activan
**solo** cuando la base no devolvió nada y `NODE_ENV !== "production"`.

En producción esto nunca ocurre: si la base viene vacía, la agenda muestra su
estado vacío y la sección de testimonios desaparece. Nunca se publica un
testimonio inventado ni un evento que no existe.

### 4. Correr en local

```bash
npm install
npm run dev
```

### 5. Dar acceso al ERP

1. Supabase → Authentication → Users → crea el usuario con su email y contraseña.
2. Copia el **User UID** y pégalo en la columna `auth_user_id` de su fila en
   `team_members`.
3. En su primer ingreso, esa persona inscribe su app autenticadora (TOTP).

---

## Deploy en Vercel

Un solo proyecto, dos dominios. En **Settings → Domains** agrega `stridechile.cl`,
`www.stridechile.cl` y `admin.stridechile.cl`. El `middleware.ts` detecta el host
`admin.` y sirve las rutas `/admin/*` automáticamente.

DNS en Cloudflare (SSL en **Full (Strict)**):

```
A      @      76.76.21.21
CNAME  www    cname.vercel-dns.com
CNAME  admin  cname.vercel-dns.com
```

Carga las mismas variables de entorno en Vercel → Settings → Environment Variables.

---

## Cómo funciona la tarjeta y la validación

```
Miembro paga en Skool
        ↓
Martín/Juanjo lo dan de alta en /admin/miembros
        ↓
El sistema genera:
  · member_code  → público, va dentro del QR
  · card_token   → secreto, es el link de su tarjeta
        ↓
Se le manda por WhatsApp:  stridechile.cl/tarjeta/<card_token>
        ↓
El miembro guarda esa página en su pantalla de inicio
        ↓
En el local: escanean el QR con la CÁMARA NATIVA del celular
        ↓
Se abre  stridechile.cl/validar/<member_code>
        ↓
Pantalla verde ✅ o roja ❌ + foto + nombre + vigencia
        ↓
Queda registrado en `scans` (con ubicación si el local la autoriza)
```

No hay app que instalar ni escáner que programar: el QR contiene la URL completa.

Si un miembro filtra su link, **Regenerar link** en su ficha invalida el anterior
al instante.

---

## Rutas

### Público
| Ruta | Qué hace |
|---|---|
| `/` | Landing + captura de leads |
| `/one` | Membresía STRIDE ONE, 4 pilares y catálogo de convenios |
| `/eventos` | Social Runs publicados, cada uno con su link de Evently |
| `/tarjeta/[token]` | Tarjeta virtual del miembro con su QR (link privado) |
| `/validar/[code]` | Verificación pública para comercios |

### ERP (`admin.stridechile.cl`)
| Ruta | Rol mínimo |
|---|---|
| `/admin` | Cualquiera del equipo |
| `/admin/tareas` | Cualquiera (un monitor solo edita las suyas) |
| `/admin/actas` | Ver: equipo · Subir: socio o líder |
| `/admin/eventos` | Ver y responder encuesta: equipo · Gestionar: socio o líder |
| `/admin/miembros` | Socio o líder |
| `/admin/escaneos` | Socio o líder |
| `/admin/convenios` | Socio o líder |
| `/admin/leads` | Socio o líder |
| `/admin/kits` | Cualquiera del equipo |
| `/admin/finanzas` | Solo socio |
| `/admin/equipo` | Solo socio |

Los permisos se aplican en dos capas: `requireTeamMember()` en cada página y las
políticas RLS en Postgres. Aunque alguien saltara la primera, la base rechaza la
consulta.

---

## El parser de actas

`lib/acta-parser.ts` lee el bloque `AUTO_PROCESSING` que ya generan las skills de
STRIDE y crea tareas, decisiones y seguimientos.

Formato de tarea:

```
TAREA | ACTA_STRIDE_20260701 | Martín | 02/07/2026 | Alta | Marketing | Contactar a Chile Suplementos…
```

Antes de guardar, `/admin/actas/nueva` muestra exactamente qué va a crear.

Los responsables compuestos (`Nicolás / Fernanda`, `Equipo de planificación`) se
guardan como texto y quedan **sin asignar a una persona** a propósito: es mejor que
alguien los reparta a mano que adjudicárselos al primero que calce.

---

## Flujo de decisión del Social Run

El módulo de eventos implementa el flujo que ya usa el equipo:

1. Se crea el evento con su mínimo de confirmaciones (por defecto **3**).
2. Se pasa a **Encuesta abierta** y cada persona marca Voy / Tal vez / No puedo.
3. El panel muestra en vivo si se alcanza el mínimo.
4. Si se alcanza, se pasa a **Confirmado**.
5. Con el link de Evently cargado, se **Publica en la web** y aparece en `/eventos`.

Un evento no se puede publicar sin link de Evently: no tiene sentido mostrar algo a
lo que nadie se puede inscribir.
