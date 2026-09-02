export type Role = "socio" | "lider_comunidad" | "monitor";
export type Priority = "alta" | "media" | "baja";
export type TaskStatus = "pendiente" | "en_progreso" | "hecha" | "recurrente" | "bloqueada";
export type EventStatus = "planificacion" | "encuesta_abierta" | "confirmado" | "cancelado" | "completado";
export type MemberStatus = "activa" | "inactiva" | "pausada";
export type RunningExperience = "nunca" | "ocasional" | "regular" | "competitivo";
export type Motivation = "social_run" | "constancia" | "membresia";
export type GeoSource = "gps" | "denegado" | "no_disponible";

export interface TeamMember {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  nickname: string | null;
  email: string;
  phone: string | null;
  role: Role;
  area: string | null;
  status: "activo" | "inactivo";
  created_at: string;
  /** Foto de perfil en el bucket team-photos (migración 005). */
  photo_path?: string | null;
  /** Columnas extra configurables desde Configuración (migración 017). */
  extra?: Record<string, string>;
}

export interface Meeting {
  id: string;
  code: string | null;
  title: string;
  meeting_date: string;
  attendees: string[];
  content_md: string;
  raw_block: string | null;
  created_by: string | null;
  created_at: string;
  /** 'socios' = acta reservada; el resto del equipo no la ve (migración 017). */
  visibility?: "equipo" | "socios";
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  assignee_label: string | null;
  area: string | null;
  priority: Priority;
  status: TaskStatus;
  start_date: string | null;
  due_date: string | null;
  meeting_id: string | null;
  event_id: string | null;
  created_at: string;
  updated_at: string;
  /** "socios" = solo fundadores (RLS lo blinda, migración 008). */
  visibility?: "equipo" | "socios";
}

export interface Decision {
  id: string;
  meeting_id: string;
  area: string | null;
  kind: string | null;
  priority: Priority | null;
  content: string;
  is_doc_update: boolean;
  created_at: string;
}

export interface Followup {
  id: string;
  meeting_id: string;
  area: string | null;
  content: string;
  resolved: boolean;
  created_at: string;
}

export interface StrideEvent {
  id: string;
  code: string | null;
  title: string;
  event_type: string;
  event_date: string;
  event_time: string | null;
  meeting_point: string | null;
  meeting_point_map_url: string | null;
  route_gpx_url: string | null;
  distance_km: number | null;
  evently_url: string | null;
  cover_image_url: string | null;
  capacity: number | null;
  spots_left: number | null;
  route_id: string | null;
  owner_id: string | null;
  status: EventStatus;
  min_confirmations: number;
  is_public: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Notas internas del equipo; jamás se muestran en la web pública. */
  internal_notes?: string | null;
}

export interface EventAvailability {
  id: string;
  event_id: string;
  team_member_id: string;
  response: "si" | "no" | "tal_vez";
  note: string | null;
  responded_at: string;
}

export interface EventConfirmationStatus {
  event_id: string;
  title: string;
  event_date: string;
  status: EventStatus;
  min_confirmations: number;
  confirmed_count: number;
  declined_count: number;
  maybe_count: number;
  meets_minimum: boolean;
}

export interface Member {
  id: string;
  auth_user_id: string | null;
  member_code: string;
  card_token: string;
  full_name: string;
  photo_url: string | null;
  photo_path: string | null;
  email: string | null;
  whatsapp: string | null;
  plan: string;
  status: MemberStatus;
  joined_at: string;
  valid_until: string | null;
  skool_handle: string | null;
  notes: string | null;
  invitation_status: "pendiente" | "enviada" | "activada" | "error";
  invited_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
  /** Cómo quiere aparecer en la comunidad; null = usa full_name. */
  display_name: string | null;
  /** Null hasta que termina (o salta) el recorrido de bienvenida. */
  onboarding_done_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Testimonial {
  id: string;
  author_name: string;
  author_role: string | null;
  photo_url: string | null;
  quote: string;
  rating: number | null;
  published: boolean;
  sort_order: number;
  created_at: string;
}

export interface Benefit {
  id: string;
  business_name: string;
  category: string;
  description: string;
  discount_label: string | null;
  address: string | null;
  instagram: string | null;
  logo_url: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  /** Coordenadas del local (migración 006), para cruzar escaneos. */
  lat?: number | null;
  lng?: number | null;
  /** Nota visible SOLO dentro del carnet (códigos de descuento, etc.). */
  member_note?: string | null;
}

export interface Scan {
  id: string;
  member_id: string | null;
  member_code: string;
  benefit_id: string | null;
  was_valid: boolean;
  scanned_at: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  geo_source: GeoSource;
  user_agent: string | null;
}

export interface Lead {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  motivation: Motivation;
  running_experience: RunningExperience | null;
  source: string;
  contact_consent: boolean;
  marketing_consent: boolean;
  consent_version: string | null;
  consented_at: string | null;
  status: "nuevo" | "contactado" | "agendado" | "convertido" | "descartado";
  /** Qué tan caliente está el lead (migración 005). */
  temperature?: "frio" | "tibio" | "caliente" | null;
  /** Etiquetas libres (migración 017). */
  tags?: string[];
  notes: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  size: string | null;
  stock: number;
  unit_cost_clp: number | null;
  created_at: string;
}

export interface Route {
  id: string;
  name: string;
  distance_km: number | null;
  difficulty: "facil" | "media" | "dificil" | null;
  start_point: string | null;
  end_point: string | null;
  gpx_url: string | null;
  external_url: string | null;
  traffic_lights: number | null;
  safety_notes: string | null;
  surface: string | null;
  notes: string | null;
  created_by: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  /** Distancias que se corren en esta ruta, ej. [3, 5] (migración 017). */
  distances_km?: number[];
  /** Fotos de la ruta en el bucket público `rutas` (migración 017). */
  image_urls?: string[];
}

export interface EventPlan {
  id: string;
  event_id: string;
  route_id: string | null;
  /** Ruta escrita a mano cuando no hay ficha en Rutas (migración 017). */
  route_text?: string | null;
  meeting_time: string | null;
  warmup_notes: string | null;
  icebreaker: string | null;
  groups_notes: string | null;
  post_run_notes: string | null;
  planner_id?: string | null;
  route_owner_id?: string | null;
  lead_id: string | null;
  sweeper_id: string | null;
  photographer_id: string | null;
  materials: string | null;
  sponsor_notes: string | null;
  contingency: string | null;
  status: "borrador" | "lista" | "ejecutada";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface MonthChecklistItem {
  id: string;
  month: string;
  template_id: string | null;
  title: string;
  category: string | null;
  notes: string | null;
  done: boolean;
  done_at: string | null;
  done_by: string | null;
  assignee_id: string | null;
  /** Responsable escrito cuando no es socio (migración 017). */
  assignee_label?: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
}

export interface MonthlyFinanceSummary {
  month: string;
  ingresos: number | null;
  costos: number | null;
  gastos: number | null;
  resultado: number;
  movimientos: number;
}

export interface Transaction {
  id: string;
  kind: "ingreso" | "costo" | "gasto";
  amount_clp: number;
  category: string;
  /** Subcategoría del catálogo (migración 007). */
  subcategory?: string | null;
  /** Área del negocio a la que se anexa el movimiento. */
  area?: string;
  description: string | null;
  event_id: string | null;
  member_id: string | null;
  occurred_on: string;
  receipt_url: string | null;
  payment_method: string | null;
  created_by: string | null;
  created_at: string;
}

/**
 * Lo único que sale de /api/validar hacia la página pública.
 * Nunca incluye email, whatsapp ni notas internas del miembro: cualquiera con
 * el código puede consultar este endpoint.
 */
export interface PublicMemberStatus {
  found: boolean;
  valid: boolean;
  full_name?: string;
  photo_url?: string | null;
  valid_until?: string | null;
  member_since?: string;
}
