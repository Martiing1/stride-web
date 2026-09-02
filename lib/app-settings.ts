import type { Role } from "./types";

/**
 * Configuración del sistema (tabla app_settings, clave/valor JSON).
 *
 * Todo lo que se ajusta desde /admin/configuracion vive acá: qué módulos ve
 * cada rol, qué widgets muestra el dashboard y cómo se llaman las columnas de
 * los tableros. Si la tabla no existe todavía (migración 005 sin correr) se
 * devuelven los valores por defecto y nada se rompe.
 */

// ─── Registro de módulos del ERP ─────────────────────────────────────────────
// Fuente única para el sidebar, el editor de permisos y las guardias.
// `roles` = quién puede verlo por código (techo duro que respalda RLS);
// la configuración solo puede ocultar DENTRO de ese techo, nunca abrir más.

export interface ModuleDef {
  href: string;
  label: string;
  section: string;
  /** Roles que el código permite. Ausente = todo el equipo. */
  roles?: Role[];
  /** Solo el dueño (Martín): la página lo exige aparte. */
  ownerOnly?: boolean;
  /** No se puede ocultar por configuración (evita dejar a alguien sin salida). */
  fixed?: boolean;
}

export const MODULES: ModuleDef[] = [
  { href: "/admin", label: "Dashboard", section: "Operaciones", fixed: true },
  { href: "/admin/tareas", label: "Tareas", section: "Operaciones" },
  { href: "/admin/actas", label: "Actas", section: "Operaciones" },
  { href: "/admin/eventos", label: "Eventos", section: "Social Run" },
  { href: "/admin/planificaciones", label: "Planificaciones", section: "Social Run" },
  { href: "/admin/rutas", label: "Rutas", section: "Social Run" },
  // Evaluaciones ya no es módulo (02-09): es un popup obligatorio tras cada
  // social run, y sus resultados viven en Métricas.
  { href: "/admin/metricas", label: "Métricas", section: "Social Run", roles: ["socio", "lider_comunidad"] },
  { href: "/admin/membresia", label: "Plan del mes", section: "Membresía", roles: ["socio", "lider_comunidad"] },
  // Administración del portal de miembros: reservada a socios. Líderes y
  // monitores operan el ERP, pero no publican ni gestionan este portal.
  { href: "https://stridechile.cl/miembros", label: "Vista Miembros ↗", section: "Membresía", roles: ["socio"] },
  // Miembros incluye ahora las verificaciones de la comunidad (antes módulo Comunidad).
  { href: "/admin/miembros", label: "Miembros", section: "Membresía", roles: ["socio"] },
  { href: "/admin/escaneos", label: "Escaneos", section: "Membresía", roles: ["socio", "lider_comunidad"] },
  { href: "/admin/convenios", label: "Convenios", section: "Membresía", roles: ["socio", "lider_comunidad"] },
  { href: "/admin/leads", label: "Leads", section: "Membresía", roles: ["socio", "lider_comunidad"] },
  { href: "/admin/documentos", label: "Documentos", section: "Recursos" },
  { href: "/admin/kits", label: "Kits e inventario", section: "Recursos" },
  { href: "/admin/finanzas", label: "Finanzas", section: "Recursos", roles: ["socio"] },
  { href: "/admin/desempeno", label: "Desempeño", section: "Configuración", roles: ["socio"] },
  { href: "/admin/reglas", label: "Reglas vigentes", section: "Configuración", fixed: true },
  { href: "/admin/incumplimientos", label: "Libro de Incumplimientos", section: "Configuración", fixed: true },
  // Equipo, Testimonios y Seguridad viven dentro de Configuración (02-09).
  // /admin/seguridad sigue existiendo para todo el equipo desde el pie del sidebar.
  { href: "/admin/configuracion", label: "Configuración", section: "Configuración", roles: ["socio"] },
];

// ─── Widgets del dashboard ───────────────────────────────────────────────────

export const DASHBOARD_WIDGETS = [
  { id: "tareas_abiertas", label: "Mis tareas abiertas" },
  { id: "tareas_vencidas", label: "Tareas vencidas del equipo" },
  { id: "asistencia_mes", label: "Asistentes a social runs del mes" },
  { id: "miembros_activos", label: "Miembros activos" },
  { id: "leads_nuevos", label: "Leads sin contactar" },
  { id: "escaneos_mes", label: "Escaneos de beneficios del mes" },
] as const;

export type WidgetId = (typeof DASHBOARD_WIDGETS)[number]["id"];

// Pedido por Martín (30-08): la asistencia a los social runs reemplaza a los
// escaneos como métrica por defecto; escaneos queda disponible como opción.
export const DEFAULT_WIDGETS: WidgetId[] = [
  "tareas_abiertas",
  "tareas_vencidas",
  "asistencia_mes",
  "miembros_activos",
  "leads_nuevos",
];

// ─── Etiquetas de tableros ───────────────────────────────────────────────────

export const DEFAULT_LEAD_LABELS: Record<string, string> = {
  nuevo: "Nuevos",
  contactado: "Contactados",
  agendado: "Agendados",
  convertido: "Convertidos",
  descartado: "Descartados",
};

export const DEFAULT_TASK_LABELS: Record<string, string> = {
  pendiente: "Pendientes",
  en_progreso: "En progreso",
  bloqueada: "Bloqueadas",
  recurrente: "Recurrentes",
  hecha: "Hechas",
};

/** Módulos visibles para un rol, cruzando el techo del código con la config. */
export function visibleModules(role: Role, isOwner: boolean, config: AppConfig): ModuleDef[] {
  const hidden = new Set(role === "socio" ? [] : config.hiddenModules[role] ?? []);
  return MODULES.filter((m) => {
    if (m.roles && !m.roles.includes(role)) return false;
    if (m.ownerOnly && !isOwner) return false;
    if (!m.fixed && hidden.has(m.href)) return false;
    return true;
  });
}

export interface TeamColumn {
  key: string;
  label: string;
}

export interface AppConfig {
  /** hrefs ocultos por rol (solo líder y monitor; socio ve todo su techo). */
  hiddenModules: Partial<Record<Role, string[]>>;
  widgets: WidgetId[];
  leadLabels: Record<string, string>;
  taskLabels: Record<string, string>;
  /** Columnas extra de la ficha de equipo, configurables (02-09). */
  teamColumns: TeamColumn[];
}
