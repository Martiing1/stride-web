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

/** Fecha de hoy en Chile (YYYY-MM-DD). El servidor de Vercel corre en UTC. */
export function todayInChile(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatDateCL(date: string | null): string {
  if (!date) return "Sin vencimiento";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
