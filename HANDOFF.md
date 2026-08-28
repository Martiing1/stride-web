# STRIDE — Estado del proyecto

> Documento de traspaso. Actualizado: **2026-08-27**, tras el lanzamiento a producción.
> Lee también `README.md` (setup, marca, posicionamiento).

---

## 🟢 EN PRODUCCIÓN

**https://stridechile.cl** está en línea y funcionando.

| Dominio | Estado |
|---|---|
| `stridechile.cl` | 200 · landing con foto, slogan y convenios reales |
| `www.stridechile.cl` | 200 |
| `admin.stridechile.cl` | Redirige a `/admin/login` · el middleware del subdominio funciona |

HTTPS válido en los tres. La conexión a Supabase está verificada en producción:
los 6 convenios que se ven en `/one` vienen de la base de datos.

---

## Arquitectura

Next.js 15 (App Router) + Tailwind + Supabase, en `/Users/martin/Documents/Stride/web`.
Un solo proyecto sirve el sitio público y el ERP: `middleware.ts` detecta el host
`admin.` y reescribe a `/admin/*`.

### Web pública

| Ruta | Qué es |
|---|---|
| `/` | Hero con foto real, agenda de encuentros, cómo funciona, STRIDE ONE, testimonios, captura |
| `/one` | Membresía, 4 pilares, catálogo de convenios |
| `/eventos` | Agenda de Social Runs con link de Evently por evento |
| `/tarjeta/[token]` | Tarjeta virtual del miembro con QR (link privado) |
| `/validar/[code]` | Verificación pública para comercios + registro de escaneo con geo |

### ERP — cuatro secciones

**Operaciones:** Dashboard · Tareas · Actas · Equipo
**Social Run:** Eventos · Planificaciones · Rutas
**Membresía:** Plan del mes · Miembros · Escaneos · Convenios · Leads
**Recursos:** Kits e inventario · Finanzas

Login con email + contraseña + **TOTP**. Roles: `socio` / `lider_comunidad` / `monitor`.
Permisos en dos capas: `requireTeamMember()` en cada página **y** políticas RLS en
Postgres. Si alguien saltara la primera, la base rechaza la consulta igual.

---

## Infraestructura

### Supabase

- Proyecto `stride` — ref `onljegsllbkvqbkeqbtt`, org `martin's projects`.
- Migraciones aplicadas: `schema.sql`, `seed.sql`, `migration-002-erp.sql`.
- `lead-consent-migration.sql` — aplicar solo si `schema.sql` se corrió antes
  del 27-08-2026 (agrega columnas de consentimiento a `leads`).
- Buckets de Storage: `rutas` (público, para los GPX) y `comprobantes`
  (privado, se abre con URL firmada de 60 s).
- La tabla `fincore_leads` pertenece a otro proyecto. **No tocar.**
- Las claves viven en `.env.local` y en Vercel. Nunca en el repo.

### Vercel

- Proyecto `stride-web` — `prj_5rqMhQfjvpOoImhLFo5JZqYrNihT`,
  team `team_f1MY0pMF4VXq6RqCRp4rA62h`.
- Framework: `nextjs`. Node 22.x.
- **El repo `Martiing1/stride-web` está DESCONECTADO a propósito.** Contenía la
  landing antigua y Martín pidió expresamente que no vuelva a desplegarse. Lo
  que se publica es la carpeta local, vía `vercel deploy`.
- Variables cargadas en Production, Preview y Development.
  `SUPABASE_SERVICE_ROLE_KEY` existe solo en Production y Preview, como *Secret*.

Para desplegar:

```bash
cd /Users/martin/Documents/Stride/web && npx vercel deploy --prod
```

### DNS (Cloudflare)

```
A      @      76.76.21.21           DNS only
CNAME  www    cname.vercel-dns.com  DNS only
CNAME  admin  cname.vercel-dns.com  DNS only
```

El aviso "DNS Change Recommended" de Vercel **no es un error**: prefiere su IP
nueva para el registro A, pero `76.76.21.21` funciona.

---

## Qué falta

### 1. Accesos

- **Los 7 emails del equipo siguen como `PENDIENTE-`** en `team_members`. La
  planilla original de Drive traía placeholders duplicados (`vale@stride.cl` en
  cuatro personas). Sin corregirlos, Nico, Tebo, Fer, Patxi, Yanis, Isa y Gemma
  no pueden entrar.
- **Juanjo no tiene acceso.** Falta crear su usuario con `juanjofloressv@gmail.com`
  y enlazar el UID.

Para dar acceso a alguien:

```
1. Supabase → Authentication → Users → crear usuario
2. Copiar el User UID → pegarlo en team_members.auth_user_id de su fila
3. En el primer login, esa persona inscribe su app autenticadora (TOTP)
```

> **Ojo con los correos de recuperación:** Gmail pre-abre los links al escanearlos
> y consume el token (`otp_expired`). Para 2-3 personas es más rápido definir la
> contraseña directo desde el panel de Supabase.

### 2. Contenido real

| Qué | Dónde | Detalle |
|---|---|---|
| Descuentos de convenios | tabla `benefits` | Los 6 nombres son correctos; las condiciones dicen "Tarifa preferente" genérico |
| Testimonios | tabla `testimonials` | Cargados con `published = false` y texto de relleno |
| Eventos reales | tabla `events` | Postergados a propósito hasta probar el módulo admin |
| Resend | `.env` | No configurado. Los leads se guardan igual, pero no llega aviso por correo |

### 3. Módulos incompletos

- **Kits e inventario es la única sección solo-lectura.** Falta CRUD de
  artículos y registro de entregas.
- **Convenios y testimonios no se editan desde el ERP** — hoy hay que entrar a
  Supabase. Para convenios importa más, porque alimentan `/one` y la tarjeta de
  cada miembro.

### 4. v2 — no empezado

- **Autocompletar evento desde el link de Evently.** Hoy el link se guarda tal
  cual y los demás campos van a mano. Se podrían leer los metadatos para
  prellenar título e imagen (fecha y hora quizás; cupos y punto de encuentro casi
  seguro que no, sin API de Evently). **Martín lo dejó explícitamente para v2.**
- **Testimonios en video** — reemplazan al carrusel actual. Hay un `TODO` en
  `components/Testimonials.tsx`.
- CRM de alianzas y sponsors (la base está en el Sheet "Carreras STRIDE").
- Módulo de marketing y contenidos.

---

## Decisiones que NO hay que revertir

Están tomadas con razón. Si algo cambia, que sea a propósito.

1. **El QR no necesita escáner.** Contiene la URL completa; el comercio usa la
   cámara nativa de su celular. Se descartó `html5-qrcode` deliberadamente.
2. **La landing no es una página de venta de la membresía.** El core es la
   comunidad y los Social Runs gratuitos. Orden: Hero → Encuentros → Cómo
   funciona → STRIDE ONE → Testimonios → Captura.
3. **STRIDE ONE se vende como mindset y constancia**, no como producto deportivo.
   Correr es la excusa.
4. **Nada de urgencia inventada.** El badge de cupos solo aparece con un número
   real en `spots_left`; los testimonios solo si están publicados.
5. **Degradado cian `#00E5FF` → indigo `#6366F1` → morado `#7C3AED`.** El logo
   original llega hasta magenta puro, pero Martín pidió bajarle al rosado. El
   morado sólido queda solo para botones (contraste).
6. **La membresía se cobra en Skool.** No hay pasarela de pago en la web, y **no
   se enlaza públicamente a Skool**: la captación va al formulario y a WhatsApp.
7. **Los responsables compuestos de las actas** ("Nicolás / Fernanda") quedan sin
   asignar a propósito, para que alguien los reparta a mano.

---

## Trampas conocidas

Todas costaron tiempo. Están documentadas para que no se repitan.

**Deploy en Vercel bloqueado (`BLOCKED`).** El motivo real no aparece en la lista
de deployments ni en `vercel inspect`. Está en el campo `readyStateReason` de la
API:

```bash
curl -s "https://api.vercel.com/v13/deployments/<dpl_id>?teamId=<team>" \
  -H "Authorization: Bearer <token>" | python3 -c "import json,sys;print(json.load(sys.stdin).get('readyStateReason'))"
```

En este proyecto fue: *"Git author X must have access to the team"* — Git no tenía
`user.email` configurado y usó `martin@<hostname>`. Ya está fijado en el repo con
el email de la cuenta Vercel. **Si aparece de nuevo, revisar el autor del commit
antes que cualquier otra cosa.**

**Otras causas de deploy fallido, en orden de aparición:**
- `framework: null` en el proyecto Vercel — quedaba como sitio estático y el build
  nunca arrancaba (duraba 0 ms).
- Sin `.vercelignore`, el CLI intenta subir los 478 MB de `node_modules` y se cuelga.
- Los dominios estaban en DNS pero **no agregados al proyecto**, así que Vercel
  nunca emitía certificado.

**No correr `next build` con el dev server arriba.** Ambos escriben en `.next` y se
pisan; el dev server queda tirando 500. Si pasa: detener, `rm -rf .next`, reiniciar.

**`/admin/login` y `/admin/activar` heredan `app/admin/layout.tsx`.** Un layout
hijo no reemplaza al padre en App Router. El middleware entrega `x-stride-pathname`
y el layout padre excluye ambas rutas antes de exigir sesión; quitar esa exclusión
vuelve a provocar `ERR_TOO_MANY_REDIRECTS`.

**Los enlaces de recuperación de Supabase usan flujo implícito** (tokens en el
`#hash`), pero `createBrowserClient` de `@supabase/ssr` usa **PKCE** y no los
procesa solo. `ActivationForm` lee el hash y llama `setSession()` a mano.

**Fondos con `-z-10` desaparecen** detrás del color del `body`. Usar `z-0` en el
fondo y `relative z-10` en el contenido.

**`text-shadow` sobre texto con `bg-clip-text`** se ve *a través* de las letras y
ensucia el degradado. Usar `drop-shadow`.

**`public/` creada después de arrancar el server** no se sirve hasta reiniciar.

---

## Piezas que vale la pena conocer

- **`lib/acta-parser.ts`** — parsea el bloque `AUTO_PROCESSING` de las actas y
  crea tareas, decisiones y seguimientos. Verificado contra un acta real: 7
  tareas, 9 decisiones, 5 seguimientos, 0 errores.
- **`lib/codes.ts`** — genera `member_code` (público, va en el QR) y `card_token`
  (secreto, es el link de la tarjeta).
- **`lib/dev-placeholders.ts`** — datos de muestra que corren **solo** si la base
  vino vacía y `NODE_ENV !== "production"`. En producción nunca se muestran.
- **`generate_month_checklist(date)`** — función SQL idempotente que crea el
  checklist del mes desde la plantilla sin duplicar lo existente.
- **`monthly_finance_summary`** — vista con ingresos, gastos y resultado por mes.
