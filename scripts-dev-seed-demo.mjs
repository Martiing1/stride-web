// Seed DEMO para visualizar la comunidad con contenido (feedback 01-09):
// 3 fechas en el calendario, la etapa Técnica "llenada" con lecciones,
// lecciones de Onboarding y Plan 5K, y una medalla digital de muestra para
// el miembro de prueba. Los eventos demo llevan code EVT-DEMO-* para poder
// limpiarlos (scripts-dev-limpiar-prueba.mjs también los borra).
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

// ── 1. Eventos demo (las 3 fechas) ──
const EVENTS = [
  {
    code: "EVT-DEMO-1",
    title: "Social Run · Parque Ecuador",
    event_type: "social_run",
    event_date: "2026-09-06",
    event_time: "09:00",
    meeting_point: "Entrada principal Parque Ecuador, Concepción",
    distance_km: 5,
    evently_url: "https://evently.cl/e/stride-social-run",
    capacity: 40,
    spots_left: 12,
    status: "confirmado",
    is_public: true,
    notes: "DEMO (borrar)",
  },
  {
    code: "EVT-DEMO-2",
    title: "Q&A en vivo · Técnica de carrera",
    event_type: "sesion_online",
    event_date: "2026-09-09",
    event_time: "20:00",
    meet_url: "https://meet.google.com/stride-demo",
    status: "confirmado",
    is_public: false,
    notes: "DEMO (borrar)",
  },
  {
    code: "EVT-DEMO-3",
    title: "Club de lectura · sesión del libro",
    event_type: "sesion_online",
    event_date: "2026-09-25",
    event_time: "19:30",
    meet_url: "https://meet.google.com/stride-demo",
    status: "confirmado",
    is_public: false,
    notes: "DEMO (borrar)",
  },
];
for (const event of EVENTS) {
  const { data: existing } = await service.from("events").select("id").eq("code", event.code).maybeSingle();
  if (existing) {
    console.log(`${event.code} ya existía`);
    continue;
  }
  const { error } = await service.from("events").insert(event);
  console.log(error ? `${event.code}: ${error.message}` : `${event.code} creado`);
}

// ── 2. Lecciones ──
async function seedLessons(courseTitle, lessons) {
  const { data: course } = await service.from("courses").select("id").eq("title", courseTitle).maybeSingle();
  if (!course) return console.log(`curso "${courseTitle}" no existe (¿migración 012?)`);
  const { count } = await service
    .from("course_lessons")
    .select("id", { count: "exact", head: true })
    .eq("course_id", course.id);
  if ((count ?? 0) > 0) return console.log(`"${courseTitle}" ya tiene lecciones`);
  const rows = lessons.map((lesson, index) => ({ ...lesson, course_id: course.id, sort_order: index }));
  const { error } = await service.from("course_lessons").insert(rows);
  console.log(error ? `"${courseTitle}": ${error.message}` : `"${courseTitle}": ${rows.length} lecciones`);
}

await seedLessons("Etapa 3 · Técnica", [
  {
    title: "Bienvenida a la etapa: qué vamos a lograr este mes",
    video_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    duration_label: "video · 4 min",
    content_md: "El foco de septiembre: correr mejor, con menos riesgo. Mira el video y anota tu objetivo del mes.",
  },
  {
    title: "Postura y cadencia: los 2 ajustes que cambian todo",
    video_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    duration_label: "video · 9 min",
    content_md: "Practica los drills 10 minutos antes de cada trote de esta semana.",
  },
  {
    title: "Guía práctica: tu sesión de técnica semanal",
    duration_label: "lectura · 5 min",
    content_md: "1 día de técnica + 2–3 trotes suaves.\n\n• Calentamiento 10 min\n• Drills: skipping, talones, zancada corta\n• 4×80 m progresivos\n• Vuelta a la calma",
  },
  {
    title: "Checklist para el reto del mes",
    duration_label: "checklist",
    content_md: "Registra cada entrenamiento en Retos con el botón. 12 en el mes = Medalla Técnica ★ Oro.",
  },
]);

await seedLessons("Onboarding STRIDE", [
  {
    title: "Bienvenido a STRIDE ONE",
    video_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    duration_label: "video · 3 min",
    content_md: "Qué incluye tu membresía y cómo sacarle el jugo desde la primera semana.",
  },
  {
    title: "Tu carnet y los convenios",
    duration_label: "lectura · 3 min",
    content_md: "Tu QR vive en Perfil. Muéstralo en los comercios aliados para tus descuentos.",
  },
]);

await seedLessons("Plan 5K", [
  { title: "Semana 1–2: base aeróbica", duration_label: "plan · lectura", content_md: "3 sesiones/semana, 90% en zona 1–2." },
  { title: "Semana 3–5: continuidad", duration_label: "plan · lectura", content_md: "Suma 5–10% de volumen. La constancia manda." },
  { title: "Semana 6–8: tu primer 5K", duration_label: "plan · lectura", content_md: "Tirada objetivo el fin de semana 8. ¡A celebrarlo en el blog!" },
]);

// ── 3. Medalla digital demo para el miembro de prueba ──
const { data: testMember } = await service
  .from("members")
  .select("id")
  .eq("email", "prueba.comunidad@stridechile.cl")
  .maybeSingle();
const { data: medal } = await service.from("medals").select("id").eq("name", "Primer Social Run").maybeSingle();
if (testMember && medal) {
  const { data: existing } = await service
    .from("member_medals")
    .select("id")
    .eq("member_id", testMember.id)
    .eq("medal_id", medal.id)
    .maybeSingle();
  if (!existing) {
    const { error } = await service.from("member_medals").insert({
      member_id: testMember.id,
      medal_id: medal.id,
      status: "otorgada",
    });
    console.log(error ? `medalla demo: ${error.message}` : "medalla digital demo otorgada");
  } else console.log("medalla demo ya existía");
} else console.log("sin miembro de prueba o sin catálogo (¿migración 012?)");

console.log("Seed demo listo.");
