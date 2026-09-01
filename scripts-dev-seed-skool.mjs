// Vuelca el contenido REAL del Skool de STRIDE (capturado de skool.com/stride-20-4391)
// a los cursos de la plataforma: subtítulos de planes, las 12 etapas del sistema
// con su estructura (etapa → entrenamiento → reto → Q&A/comunidad → beneficios)
// y el pitch de "Acerca de" como lección de Onboarding.
// Idempotente: actualiza cursos por título y REEMPLAZA sus lecciones.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("./.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function upsertCourse(title, fields) {
  const { data: existing } = await service.from("courses").select("id").eq("title", title).maybeSingle();
  if (existing) {
    await service.from("courses").update(fields).eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await service.from("courses").insert({ title, active: true, ...fields }).select("id").single();
  if (error) throw new Error(`${title}: ${error.message}`);
  return data.id;
}

async function replaceLessons(courseId, title, lessons) {
  await service.from("course_lessons").delete().eq("course_id", courseId);
  const rows = lessons.map((lesson, index) => ({ ...lesson, course_id: courseId, sort_order: index }));
  const { error } = await service.from("course_lessons").insert(rows);
  console.log(error ? `${title}: ${error.message}` : `${title}: ${rows.length} lecciones`);
}

const L = (title, content_md, duration_label = "lectura") => ({ title, content_md, duration_label });

// ─── Onboarding ───────────────────────────────────────────────────────────────
{
  const id = await upsertCourse("Onboarding STRIDE", {
    subtitle: "Qué es STRIDE ONE y cómo sacarle el jugo",
    emoji: "👋", category: "biblioteca", sort_order: 0,
  });
  await replaceLessons(id, "Onboarding STRIDE", [
    L("Qué es STRIDE ONE",
`¿Cuántas veces has partido con todo en enero… y en marzo ya no queda nada?

STRIDE ONE existe para eso: dejar de empezar de cero. No es una app ni un plan en PDF — es un sistema mensual con una comunidad real detrás.

Cada mes tiene su temática, e incluye:
• Tu plan según nivel (5K, 10K o 21K)
• Foco y reto del mes + micro-retos semanales
• Módulos de nutrición, movilidad, fuerza, mentalidad y club de lectura
• Sesiones en vivo de bienvenida y cierre de mes
• Tarjeta STRIDE: hasta 30% de descuento en comercios aliados
• Kit de bienvenida exclusivo de miembros

Mes a mes, sin permanencia. Los Social Runs abiertos siguen siendo gratis, siempre.

Correr es la excusa. El hábito es lo que te llevas.`),
    L("Cómo funciona la plataforma",
`• Blog: el muro de la comunidad. Publica tus entrenamientos, celebra logros y comenta. Escribe @ para mencionar un reto y avanzarlo desde tu post.
• Hábitos: define hasta 4 y márcalos cada día — tu racha vive arriba del Blog. Solo tú ves el detalle.
• Retos: el reto del mes y los micro-retos. Cada avance suma puntos y las medallas quedan en tu vitrina.
• Calendario: Social Runs y sesiones en vivo, con un toque los dejas en tu calendario.
• Ranking: parte de cero cada mes. Premia la constancia, nunca la velocidad.
• Perfil: tu carnet con QR para los convenios, tus números y tu vitrina de medallas.`),
    L("Tu carnet y los convenios",
`Tu QR vive en Perfil y rota solo (nadie puede copiarlo). Muéstralo en los comercios aliados para tus descuentos.

Consejo: deja la app en tu pantalla de inicio (Perfil → "Déjalo en tu pantalla de inicio") y el carnet queda a un toque.`),
  ]);
}

// ─── Planes ───────────────────────────────────────────────────────────────────
{
  const id = await upsertCourse("Plan 5K", {
    subtitle: "8 semanas · base aeróbica y adherencia", emoji: "5️⃣", category: "plan", sort_order: 1,
  });
  await replaceLessons(id, "Plan 5K", [
    L("Enfoque del plan", "Construcción de base aeróbica, técnica biomecánica y adherencia para correr y poder ir más lejos sin frustración."),
    L("Cómo se entrena", "Programa de 8 semanas · 3 sesiones por semana adaptadas a tu nivel, con un 90% del volumen enfocado en Zona 1–2 (base aeróbica)."),
    L("Checklist semanal", "Marca tus sesiones en Retos (+1 entrenamiento) y aparece al Social Run del domingo: eso alimenta tu racha y el reto del mes.", "checklist"),
  ]);
}
{
  const id = await upsertCourse("Plan 10K", {
    subtitle: "10 semanas · gestión del ritmo y la energía", emoji: "🔟", category: "plan", sort_order: 2,
  });
  await replaceLessons(id, "Plan 10K", [
    L("Enfoque del plan", "Transición y gestión de la energía a lo largo del tiempo: aprender a manejar el ritmo desde el inicio y superar la fatiga mental a partir del kilómetro 6 o 7.\n\nRequisito inicial: correr 30 minutos continuos sin detenerse."),
    L("Cómo se entrena", "Programa de 10 semanas · 3 a 4 sesiones semanales, desplazando estratégicamente parte del volumen hacia Zona 3 y 4 (trabajo de calidad)."),
  ]);
}
{
  const id = await upsertCourse("Plan 21K", {
    subtitle: "14 semanas · media maratón", emoji: "🏅", category: "plan", sort_order: 3,
  });
  await replaceLessons(id, "Plan 21K", [
    L("Enfoque del plan", "Media maratón: gestionar esfuerzos largos sostenidos, dominar la curva de sensaciones y superar la pared psicológica del kilómetro 18."),
    L("Cómo se entrena", "Programa de 14 semanas · programación de carrera avanzada y progresiva para generar adaptaciones orgánicas profundas."),
  ]);
}

// ─── Las 12 etapas (sistema mensual, tal como en Skool) ──────────────────────
const ETAPAS = [
  ["Etapa 1 · Inicio", "🚀", "2026-07-01", "Entra en ritmo, conoce la comunidad y construye base",
    "Entrar en ritmo, conocer la comunidad y construir una base para moverse sin frustración.",
    "3–4 sesiones por semana según nivel (principiante, intermedio, avanzado).",
    "Reto: 8 entrenamientos + 1 Social Run.\nRecompensa: Kit de bienvenida.",
    "Q&A inicial de bienvenida.\nComunidad: preséntate en el Blog + ranking semanal.",
    "Beneficios del mes con la tarjeta STRIDE."],
  ["Etapa 2 · Constancia", "📈", "2026-08-01", "De la motivación inicial al hábito",
    "Transformar la motivación inicial en hábito: sostener una frecuencia semanal realista.",
    "3–4 sesiones semanales según nivel, intensidad adaptada para evitar sobrecarga.",
    "Reto: 10 entrenamientos + 2 Social Runs.\nRecompensa: descuento de marca aliada + sorteo interno.",
    "Q&A: motivación y cómo sostener el compromiso.",
    "Beneficios: café gratis + partner fitness."],
  ["Etapa 3 · Técnica", "🎯", "2026-09-01", "Correr mejor, con menos riesgo",
    "Mejorar la forma de correr, reducir riesgos y moverse con más eficiencia.",
    "1 día de técnica semanal + 2–3 trotes normales según nivel.",
    "Reto: 12 entrenamientos + subir 1 video de técnica.\nRecompensa: Polera oficial STRIDE.",
    "Q&A: técnica de carrera y prevención de lesiones.\nComunidad: feedback grupal de videos.",
    "Beneficios: descuentos en kinesiología, recovery o crioterapia."],
  ["Etapa 4 · Resistencia", "🛡️", "2026-10-01", "Sostener distancia con control",
    "Sostener distancia progresando en kilometraje sin perder control ni motivación.",
    "1 tirada larga semanal + sesiones de trote fácil. Progresión de km según nivel.",
    "Reto: 15 km acumulados + 10 entrenamientos.\nRecompensa: Medalla STRIDE.",
    "Q&A: nutrición básica y manejo del aumento de distancia.\nComunidad: ranking de km.",
    "Beneficios: hidratación y suplementos."],
  ["Etapa 5 · Comunidad", "🫂", "2026-11-01", "Correr con otros como centro",
    "Correr con otros como parte central de la experiencia: entrenamientos grupales + Social Runs integrados.",
    "Sesiones adaptadas para todos los niveles.",
    "Reto: 3 Social Runs + 8 entrenamientos.\nRecompensa: café grupal o beneficio con partner.",
    "Q&A: progreso, pertenencia y continuidad.\nComunidad: dinámicas por duplas, corre con alguien nuevo.",
    "Beneficios: packs con cafeterías."],
  ["Etapa 6 · Superación", "⛰️", "2026-12-01", "Tu desafío 5K o 10K",
    "Preparar y completar un desafío 5K o 10K según tu nivel.",
    "Plan progresivo con preparación y recuperación.",
    "Reto: completar un 5K o 10K.\nRecompensa: Polera finisher y certificado.",
    "Q&A: preparación mental, recuperación y cómo enfrentar el desafío final.\nComunidad: evento de cierre de ciclo.",
    "Beneficios: descuento para el evento interno."],
  ["Etapa 7 · Reenganche", "🔄", "2027-01-01", "Reiniciar el ciclo sin culpa",
    "Reiniciar sin culpa, especialmente después de pausas o baja de motivación.",
    "Retomar progresivamente 3–4 sesiones semanales con sesiones controladas.",
    "Reto: completar 10 entrenamientos.\nRecompensa: beneficio de marca aliada.",
    "Q&A: retomar sin frustración, con ajustes inteligentes.\nComunidad: reactivación y seguimiento de quienes vuelven.",
    "Beneficios: descuento con partner."],
  ["Etapa 8 · Velocidad", "⚡", "2027-02-01", "Medir y mejorar tu progreso personal",
    "Mejora de tiempos: medir, entrenar y comparar tu progreso contra ti mismo.",
    "Series e intervalos adaptados por nivel, progresivos y controlados para evitar sobrecarga.",
    "Reto: test de inicio y test final buscando tu mejora personal.\nRecompensa: acceso a contenido de entrenamiento avanzado.",
    "Q&A: mejora de tiempos y técnica aplicada.\nComunidad: celebración de mejoras personales.",
    "Beneficios: beneficio performance."],
  ["Etapa 9 · Experiencia", "🌅", "2027-03-01", "Bajar el foco técnico, reforzar el disfrute",
    "Correr como experiencia, conversación y estilo de vida.",
    "Entrenamientos libres con menor rigidez y más disfrute. Social Runs como parte activa.",
    "Reto: 3 Social Runs + 8 entrenamientos.\nRecompensa: Merch STRIDE (gorro o accesorio).",
    "Q&A: disfrute del proceso y continuidad.\nComunidad: activaciones especiales.",
    "Beneficios: lifestyle."],
  ["Etapa 10 · Desafío", "🏔️", "2027-04-01", "Empujar límites de forma controlada",
    "Subir la intensidad para empujar límites de forma controlada y preparar una versión más fuerte.",
    "Mayor intensidad y volumen, sesiones progresivas con seguimiento. Adaptación por nivel.",
    "Reto: completar 15 entrenamientos.\nRecompensa: medalla avanzada.",
    "Q&A: superar límites y trabajar mentalidad.",
    "Beneficios: marcas aliadas."],
  ["Etapa 11 · Peak", "🏁", "2027-05-01", "El punto alto: 10K o trail",
    "Preparar el punto alto del proceso: trabajar hacia tu mejor versión con objetivo final 10K o trail.",
    "Sesiones específicas según objetivo y ajuste final antes del desafío.",
    "Reto: completar un 10K o trail.\nRecompensa: Polera premium STRIDE.",
    "Q&A: preparación final, tapering y manejo de la ansiedad.\nComunidad: preparación grupal para el evento.",
    "Beneficios: descuentos en eventos."],
  ["Etapa 12 · Cierre", "🎓", "2027-06-01", "Mantención, reflexión y celebración",
    "Cerrar el ciclo con mantención, reflexión y celebración. No se trata de terminar, sino de proyectar la identidad construida.",
    "Sesiones ligeras para sostener el hábito. Espacio para revisar avances y proyectar el siguiente ciclo.",
    "Reto: completar el ciclo activo.\nRecompensa: acceso al retiro y premiación.",
    "Q&A: reflexión y cierre.\nComunidad: premiación y cierre de ciclo.",
    "Beneficios: retiro."],
];

let sort = 10;
for (const [title, emoji, opensMonth, subtitle, intro, training, reto, qa, beneficios] of ETAPAS) {
  const id = await upsertCourse(title, {
    subtitle, emoji, category: "etapa", opens_month: opensMonth, sort_order: sort++,
  });
  await replaceLessons(id, title, [
    L("La etapa del mes", intro),
    L("Cómo se entrena este mes", training),
    L("Reto y recompensa", `${reto}\n\nEl reto vive en la pestaña Retos: registra tus avances ahí (o publica en el Blog mencionando @el reto).`),
    L("Q&A y comunidad", qa),
    L("Beneficios del mes", `${beneficios}\nMuestra el QR de tu Perfil en los comercios aliados.`),
  ]);
}

console.log("Contenido de Skool volcado ✅");
