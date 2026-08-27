import type { Role } from "./types";

/**
 * Constantes de rol sin dependencias de servidor.
 *
 * Viven separadas de `lib/auth.ts` porque los componentes de cliente (el menú
 * lateral, por ejemplo) las necesitan, y `lib/auth.ts` importa `next/headers`,
 * que no puede entrar al bundle del navegador.
 */
export const ROLE_LABELS: Record<Role, string> = {
  socio: "Socio",
  lider_comunidad: "Líder de Comunidad",
  monitor: "Monitor",
};

/** Socios y líderes gestionan la operación; los monitores solo ven lo suyo. */
export function isStaff(role: Role): boolean {
  return role === "socio" || role === "lider_comunidad";
}
