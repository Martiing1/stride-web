import type { Member } from "./types";

/**
 * Una membresía sirve si está activa y no venció.
 * `valid_until` null se trata como vigencia indefinida (miembro fundador,
 * cortesía o convenio especial cargado a mano).
 */
export function isMembershipValid(member: Pick<Member, "status" | "valid_until">): boolean {
  if (member.status !== "activa") return false;
  if (!member.valid_until) return true;

  // Comparación por fecha en zona horaria de Chile, no por timestamp UTC: una
  // membresía que vence hoy debe seguir sirviendo durante todo el día en Chile.
  return member.valid_until >= todayInChile();
}

/** Fecha (YYYY-MM-DD) en Chile de un instante dado. El servidor de Vercel corre en UTC. */
export function dateInChile(at: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof at === "string" ? new Date(at) : at);
}

/** Fecha de hoy en Chile (YYYY-MM-DD). */
export function todayInChile(): string {
  return dateInChile(new Date());
}

/** Suma días a una fecha YYYY-MM-DD (aritmética de calendario, sin zona). */
export function addDaysIso(date: string, days: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Lunes (YYYY-MM-DD) de la semana que contiene la fecha dada. Los micro-retos
 * corren de lunes a domingo, hora Chile, y se reinician cada lunes.
 */
export function weekStartChile(date: string = todayInChile()): string {
  const day = (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7; // lunes = 0
  return addDaysIso(date, -day);
}

/** Semana centinela del avance en retos que no son semanales. */
export const NO_WEEK = "1970-01-01";

export function formatDateCL(date: string | null): string {
  if (!date) return "Sin vencimiento";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
