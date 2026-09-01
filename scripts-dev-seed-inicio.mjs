// Vuelca el MÓDULO INICIO REAL de Skool (8 lecciones capturadas el 01-09) y
// recalibra el drip: Etapa 1 · Inicio = mes actual (sep 2026); el resto avanza
// un mes cada una. También alinea los retos del mes a los de Inicio.
// Referencias adaptadas: el "Carnet Interactivo" ahora es la pestaña Perfil,
// y los hashtags viven como menciones @reto en el Blog.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("./.env.local", import.meta.url), "utf8")
    .split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── 1. Recalibrar el drip: Inicio = 2026-09, +1 mes cada etapa ──
const ORDER = ["Etapa 1 · Inicio","Etapa 2 · Constancia","Etapa 3 · Técnica","Etapa 4 · Resistencia","Etapa 5 · Comunidad","Etapa 6 · Superación","Etapa 7 · Reenganche","Etapa 8 · Velocidad","Etapa 9 · Experiencia","Etapa 10 · Desafío","Etapa 11 · Peak","Etapa 12 · Cierre"];
for (let i = 0; i < ORDER.length; i++) {
  const d = new Date(Date.UTC(2026, 8 + i, 1)); // sep 2026 + i
  const month = d.toISOString().slice(0, 10);
  const { error } = await s.from("courses").update({ opens_month: month }).eq("title", ORDER[i]);
  console.log(error ? `${ORDER[i]}: ${error.message}` : `${ORDER[i]} → ${month}`);
}

// Subtítulos con los taglines reales de las portadas de Skool
await s.from("courses").update({ subtitle: "Entra en ritmo. Conoce la comunidad. Empieza acompañado." }).eq("title", "Etapa 1 · Inicio");
await s.from("courses").update({ subtitle: "Construye tu base. Conquista tu distancia. Siente el progreso. · 8 semanas" }).eq("title", "Plan 5K");
await s.from("courses").update({ subtitle: "Suma kilómetros. Desafía tu resistencia. Supera tus límites. · 10 semanas" }).eq("title", "Plan 10K");
await s.from("courses").update({ subtitle: "Foco y consistencia. Domina la media maratón. Consigue tu meta. · 14 semanas" }).eq("title", "Plan 21K");

// ── 2. Las 8 lecciones REALES del módulo Inicio ──
const { data: inicio } = await s.from("courses").select("id").eq("title", "Etapa 1 · Inicio").single();
await s.from("course_lessons").delete().eq("course_id", inicio.id);

const L = (title, content_md, duration_label = "lectura", video_url = null) =>
  ({ title, content_md, duration_label, video_url });

const lessons = [
  L("🚀 ¡Llegaste! Empieza aquí",
`Bienvenido al Equipo StrideOne. En este video te contamos lo que hacemos y por qué lo hacemos — para que te sientas cómodo, salgas de tu zona de confort y, por sobre todo, disfrutes haciendo deporte.

Después de verlo: preséntate en el Blog (canal Presentación) y crea tus hábitos del mes.`,
    "video · 3 min", "https://www.youtube.com/embed/ewE2avvlz8o"),

  L("Semana 1 — Entrena y Actívate",
`Es tu primera semana oficial en StrideOne. La meta no es correr rápido ni lejos: es descubrir que moverse es mejor acompañado.

Marca tu semana en el Perfil y registra tus sesiones en Retos.

NIVEL 1 — Explora en movimiento
3 sesiones de 20–25 min (camina/trota). Al menos 1 sesión junto a otra persona — amigo, pareja, vecino. La mascota cuenta, pero suma doble si es humano 😄

NIVEL 2 — Deporte + cardio
3 sesiones de 25–30 min a ritmo conversacional + prueba 1 actividad deportiva distinta al running, con alguien más (bici, pádel, baile, básquet, lo que sea).

NIVEL 3 — Reta a tu grupo
4 sesiones (10 min trote suave + 4×(2 min rápido / 2 min recuperación) + enfriamiento) + súmate u organiza una sesión grupal.

💡 TIP DE LA SEMANA
Cómo respirar en el trote para no agitarte: inhala por la nariz 2 pasos, exhala por la boca 2 pasos. Si no puedes hablar mientras corres, vas demasiado rápido. Baja el ritmo — eso también es entrenar.

📸 MICRORETO — Postal de Movimiento
Una foto creativa (nada de selfie de espejo) mostrando cómo te moviste hoy, junto a alguien más. Publícala en el Blog mencionando el @micro-reto.

💬 CHECK-IN SEMANAL
¿Completaste tus sesiones? Cuéntalo en el Blog: "SÍ lo hice ✅" · "Hice lo que pude 🏃" · "Me costó, pero aquí sigo 💪". Tu respuesta suma puntos y el equipo te responde.`),

  L("Semana 2 — Construye el Hábito",
`Esta semana el hábito se sostiene más fácil si no lo cargas solo. Busca gente para sumar a tus sesiones.

NIVEL 1 — Trae a alguien nuevo
3 sesiones de 25 min (2 min trote / 1 min caminata) + invita a 1 persona distinta a acompañarte al menos una vez.

NIVEL 2 — Prueba una clase grupal
3 sesiones de 30–35 min a ritmo conversacional + súmate a una clase grupal (yoga, funcional, zumba, spinning).

NIVEL 3 — Entrena en equipo
4 sesiones (calentamiento + 5×(2 min rápido / 90 s recuperación) + enfriamiento) + 1 sesión de deporte de equipo o entreno cruzado con mínimo 2 personas.

💡 TIP DE LA SEMANA
La diferencia entre motivación y disciplina: la motivación te hace empezar, la disciplina te hace continuar. Cuando no tengas ganas, sal igual — aunque sea 20 minutos. El hábito se construye con repetición, no con inspiración.

🙋 MICRORETO — Invita a un Desconocido
Suma a alguien que casi no conoces (vecino, compañero de curso o trabajo, alguien del parque) a moverse contigo. Cuenta cómo fue en el Blog con el @micro-reto.

💬 CHECK-IN SEMANAL
¿A qué hora prefieres entrenar? 🌅 Mañana · ☀️ Mediodía · 🌆 Tarde/Noche. Compártelo en el Blog — puede ayudar a otros a organizarse.`),

  L("Semana 3 — Supera la Barrera",
`Aquí es donde muchos se quieren rendir. Esta semana lo enfrentas acompañado.

NIVEL 1 — Algo 100% nuevo
3 sesiones de 30 min (3 min trote / 1 min caminata) + prueba una actividad que nunca has hecho, con alguien al lado.

NIVEL 2 — Evento comunitario
3 sesiones de 35 min + súmate a un evento deportivo comunitario (carrera local, torneo amateur, junta deportiva del barrio).

NIVEL 3 — Organiza tú la salida
4 sesiones incl. 1 trote largo de 40 min sin intervalos + organiza tú una salida grupal para el Equipo StrideOne.

💡 TIP DE LA SEMANA
El truco de los 5 minutos: cuando no tengas ganas de salir, comprométete solo con 5 minutos. Sal, empieza a moverte. En el 90% de los casos vas a seguir. Y si paras a los 5 minutos, igual ganaste — saliste.

🎲 MICRORETO — Reto Sorpresa
El equipo sortea una actividad al azar esta semana (atento al anuncio en el Blog). Hazla con alguien más y compártela con el @micro-reto.

💬 CHECK-IN SEMANAL
Esta semana es la más difícil de la etapa. ¿Saliste aunque no querías? ¿Qué estrategia usaste para no saltarte? Compártelo — tu experiencia puede ayudar a otro miembro.`),

  L("Semana 4 — Cierre Fuerte",
`Última semana de la etapa. Cierras acompañado, no solo — con más energía que cuando empezaste.

NIVEL 1 — Cierre celebratorio
3 sesiones de 30 min buscando 5 min de trote seguido + cierra con una sesión grupal para celebrar el mes.

NIVEL 2 — Tu sesión más larga, en compañía
3–4 sesiones + cierra con 40 min a ritmo cómodo, junto a alguien que te acompañe parte o todo el trayecto.

NIVEL 3 — Test de cierre con testigos
12 min / 1 km cronometrado + sesiones normales, con alguien que te tome el tiempo y te aliente.

💡 TIP DE CIERRE DE ETAPA
Terminar una etapa completa de entrenamiento ya es un logro. Muchos empiezan, pocos terminan el inicio. Tú llegaste aquí. Eso no es suerte — es decisión.

🎬 MICRORETO — Video Colectivo del Mes
Graba 5–10 s de tu sesión de cierre (solo o en grupo) y súbelo al Blog. El equipo arma un video colectivo con los clips de todo el Equipo StrideOne.

✍️ REFLEXIÓN DE CIERRE
Antes de marcar la etapa como completa, comparte en el Blog:
1. ¿Qué cambió en ti esta etapa (aunque sea algo pequeño)?
2. ¿Cuál fue el momento más difícil y cómo lo superaste?
3. ¿A qué te comprometes para la próxima etapa?

🏆 ¡LO LOGRASTE! Completa también el Reto Mensual y avanza a Constancia.`),

  L("🏆 Reto Mensual — Conexión",
`El inicio tiene reto de conexión. La idea es simple: empieza a moverte con otros, aunque sean desconocidos.

📸 TU RETO: sácate fotos con 10 desconocidos + participa en 1 Social Run (mínimo).

¿Cómo completarlo?
1. Acércate a alguien en un parque, gimnasio o evento deportivo y pídele una foto. No tiene que ser runner: cualquier persona activa cuenta.
2. Participa en 1 Social Run (mínimo) durante la etapa — revisa el Calendario.
3. Publica tus fotos en el Blog mencionando el @reto del mes: quedan como evidencia y el equipo lo ve.

🎁 RECOMPENSA
Kit de bienvenida oficial StrideOne: sticker exclusivo + acceso oficial al equipo + reconocimiento público en la comunidad.

🎯 BENEFICIOS DE LA ETAPA
Descuento en café + descuento en tienda deportiva básica para miembros activos (muestra el QR de tu Perfil).

💬 Q&A DE LA ETAPA
2 sesiones en vivo: frustración inicial y cómo mantener el ritmo — fechas en el Calendario.

👥 ACCIÓN COMUNITARIA
Preséntate en el Blog (canal Presentación) y aparece en el primer Ranking del equipo.`),

  L("📚 Biblioteca — Recursos del Mes",
`Todo lo que necesitas para empezar bien esta etapa: guías, lecturas y herramientas prácticas.

📄 GUÍAS DESCARGABLES
• Guía 1 — "Cómo empezar a correr sin lesionarte": errores más comunes del principiante y cómo evitarlos (calentamiento básico, progresión de distancia, señales de alerta).
→ drive.google.com/file/d/1wEvFUuqxjHq1xuWhIEkY_vogTMWnvrKs/view
• Guía 2 — "Alimentación básica para runner principiante": no es una dieta, es sentido común sobre qué comer antes, durante y después de entrenar.
→ drive.google.com/file/d/1RgXo0R43CcD_Bi42Rj8uNwHxbJNEtzPP/view

📖 LIBRO DEL MES — CLUB DE LECTURA
"Nacidos para Correr" de Christopher McDougall — la historia real de la tribu Tarahumara y su forma de correr como comunidad, alegría y conexión.

3 preguntas mientras lees:
1. ¿Qué parte del libro te habló directamente?
2. ¿Cambia algo en tu forma de entender el correr?
3. ¿Qué frase subrayarías?
→ Comparte tu reflexión en el Blog. Nos vemos en el club de lectura (fecha en el Calendario).

🎵 PLAYLIST STRIDE
La playlist del equipo para entrenar esta etapa:
→ open.spotify.com/playlist/6jCP9nnAM7y5DQv4Rq2OiA

💬 ¿Qué recurso te gustaría para la próxima etapa? Proponlo en el Blog — esta biblioteca la construimos entre todos.`),

  L("🎤 Un Minuto Contigo — Preséntate",
`El Equipo Stride no es una lista de suscriptores. Somos personas reales con historias reales. Y queremos conocer la tuya.

🎬 CÓMO HACERLO
Graba un video de 60–90 segundos desde tu celular respondiendo:
1. ¿Cómo te llamas y de dónde eres?
2. ¿Desde cuándo corres (o cuándo empezaste)?
3. ¿Por qué te uniste a Stride?
4. ¿Qué esperas de esta comunidad?

No tiene que ser perfecto. Cámara de frente, luz natural, habla normal. Ese es el estilo Stride.

📤 CÓMO COMPARTIRLO
Publica tu presentación en el Blog, canal Presentación (video por ahora vía link, o foto + texto).

🏆 ¿QUÉ PASA CUANDO LO SUBES?
→ Sumas puntos al ranking.
→ El equipo comenta tu presentación personalmente.

💬 ¿Prefieres solo texto? También vale: tu nombre, tu ciudad, tu nivel (1, 2 o 3) y por qué corres — en una frase. El equipo te da la bienvenida oficial.`),
];

const rows = lessons.map((lesson, index) => ({ ...lesson, course_id: inicio.id, sort_order: index }));
const { error: lessonsError } = await s.from("course_lessons").insert(rows);
console.log(lessonsError ? `lecciones: ${lessonsError.message}` : `Etapa 1 · Inicio: ${rows.length} lecciones REALES`);

// ── 3. Retos del mes = los de Inicio (desactiva los de Técnica sembrados antes) ──
await s.from("challenges").update({ active: false }).in("title", ["12 entrenamientos en septiembre", "Sube un video de tu técnica"]);

const { data: kitMedal } = await s.from("medals").select("id").eq("name", "Reto de Conexión").maybeSingle();
let medalId = kitMedal?.id;
if (!medalId) {
  const { data: created } = await s.from("medals").insert({
    name: "Reto de Conexión",
    description: "Completaste el reto del mes de Inicio: 10 desconocidos + 1 Social Run.",
    rarity: "oro", emoji: "🤝", kind: "reto",
  }).select("id").single();
  medalId = created?.id;
}

const NEW_CHALLENGES = [
  { title: "Reto de Conexión: 10 fotos + 1 Social Run", description: "Fotos con 10 desconocidos + participa en 1 Social Run. Publica la evidencia en el Blog con @reto.", period: "mes", criterio: "evidencia", goal: 1, points: 50, medal_id: medalId, month: "2026-09-01" },
  { title: "Registra tus sesiones de la semana", description: "3 sesiones según tu nivel (revisa la semana en curso del Classroom).", period: "semana", criterio: "cantidad", goal: 3, points: 15, medal_id: null, month: "2026-09-01" },
  { title: "Micro-reto: Postal de Movimiento", description: "Una foto creativa moviéndote junto a alguien más. Publícala en el Blog mencionando este reto.", period: "semana", criterio: "evidencia", goal: 1, points: 15, medal_id: null, month: "2026-09-01" },
];
for (const challenge of NEW_CHALLENGES) {
  const { data: exists } = await s.from("challenges").select("id").eq("title", challenge.title).maybeSingle();
  if (exists) { console.log(`reto "${challenge.title}" ya existía`); continue; }
  const { error } = await s.from("challenges").insert(challenge);
  console.log(error ? `reto: ${error.message}` : `reto creado: ${challenge.title}`);
}

console.log("Inicio real + drip recalibrado ✅");
