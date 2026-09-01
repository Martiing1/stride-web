/**
 * Constantes y tipos de la comunidad que también usan componentes cliente.
 * (lib/community.ts es server-only; esto es lo único compartible.)
 */

export interface PointsWeights {
  post: number;
  comment: number;
  like_received: number;
  social_run: number;
  sesion_online: number;
  habitos_dia: number;
  reto_mes: number;
  micro_reto: number;
  reto_general: number;
  hito: number;
}

export const DEFAULT_POINTS: PointsWeights = {
  post: 5,
  comment: 2,
  like_received: 1,
  social_run: 20,
  sesion_online: 10,
  habitos_dia: 3,
  reto_mes: 50,
  micro_reto: 15,
  reto_general: 30,
  hito: 25,
};

export const MAX_HABITS = 4;

/** Nombre con el que un miembro aparece en la comunidad (Blog, Ranking, comentarios). */
export function memberDisplayName(m: { display_name?: string | null; full_name: string }): string {
  return m.display_name?.trim() || m.full_name;
}
