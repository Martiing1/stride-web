import type { Testimonial, StrideEvent } from "./types";

/**
 * Datos de muestra para desarrollo.
 *
 * Solo se usan cuando `NODE_ENV !== "production"` y la base no devolvió nada
 * (por ejemplo, con Supabase aún sin conectar). Sirven para poder diseñar y
 * revisar las secciones sin datos reales.
 *
 * En producción NUNCA se muestran: la landing prefiere esconder la sección
 * antes que publicar un testimonio inventado o un evento que no existe.
 */
export const isDev = process.env.NODE_ENV !== "production";

const testimonial = (
  id: string,
  author_name: string,
  author_role: string,
  quote: string
): Testimonial => ({
  id,
  author_name,
  author_role,
  photo_url: null,
  quote,
  rating: 5,
  published: true,
  sort_order: Number(id),
  created_at: "",
});

export const DEV_TESTIMONIALS: Testimonial[] = [
  testimonial("1", "Camila", "Miembro desde 2025", "Llegué sola y hoy corro con amigos. La energía de los domingos es otra cosa."),
  testimonial("2", "Tomás", "Social Runner", "Nunca pensé que me levantaría un domingo a las 8 AM. STRIDE lo logró."),
  testimonial("3", "Vale", "Miembro STRIDE ONE", "Más que un grupo de running, encontré mi lugar para desconectar."),
  testimonial("4", "Nacho", "Social Runner", "Fui a uno por curiosidad y no he faltado a ninguno desde entonces."),
  testimonial("5", "Fran", "Miembro STRIDE ONE", "Los convenios solos ya pagan la membresía. El resto es ganancia."),
];

const eventBase = {
  code: null,
  meeting_point_map_url: "https://maps.google.com",
  route_gpx_url: null,
  cover_image_url: null,
  capacity: 40,
  route_id: null,
  owner_id: null,
  status: "confirmado" as const,
  min_confirmations: 3,
  is_public: true,
  notes: null,
  created_at: "",
  updated_at: "",
};

/** Fechas relativas a hoy para que nunca aparezcan como eventos pasados. */
function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const DEV_EVENTS: StrideEvent[] = [
  {
    ...eventBase,
    id: "dev-1",
    event_type: "social_run",
    title: "Social Run Parque Ecuador",
    event_date: inDays(5),
    event_time: "09:30:00",
    meeting_point: "Parque Ecuador",
    distance_km: 5,
    evently_url: "https://evently.cl",
    spots_left: 24,
  },
  {
    ...eventBase,
    id: "dev-2",
    event_type: "social_run_sunset",
    title: "Sunset Run Costanera",
    event_date: inDays(12),
    event_time: "18:30:00",
    meeting_point: "Costanera, Concepción",
    distance_km: 8,
    evently_url: "https://evently.cl",
    spots_left: 4,
  },
  {
    ...eventBase,
    id: "dev-3",
    event_type: "social_run_cafeteria",
    title: "Social Run Cafetería",
    event_date: inDays(19),
    event_time: "10:00:00",
    meeting_point: "Dreams Café",
    distance_km: 5,
    evently_url: "https://evently.cl",
    spots_left: 12,
  },
];
