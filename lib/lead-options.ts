import type { Motivation, RunningExperience } from "./types";

/**
 * Única pregunta del formulario de captura.
 *
 * Tres opciones, ordenadas por temperatura: quien elige 'membresia' llega
 * decidido y se le responde derecho con STRIDE ONE; quien elige 'social_run'
 * viene a probar y se le manda el próximo evento.
 *
 * No se pregunta el nivel de running: agregaba fricción y el dato casi no se
 * usaba.
 */
export const MOTIVATION_OPTIONS: { value: Motivation; label: string; hint: string }[] = [
  {
    value: "social_run",
    label: "Quiero ir a un Social Run",
    hint: "Vengo a probar, sin compromiso.",
  },
  {
    value: "constancia",
    label: "Busco constancia y comunidad",
    hint: "Empiezo y lo dejo. Quiero sostenerlo con gente al lado.",
  },
  {
    value: "membresia",
    label: "Quiero entrar a STRIDE ONE",
    hint: "Ya lo tengo claro, cuéntenme cómo me inscribo.",
  },
];

export const MOTIVATION_LABELS: Record<Motivation, string> = Object.fromEntries(
  MOTIVATION_OPTIONS.map((o) => [o.value, o.label])
) as Record<Motivation, string>;

/** Ya no se pregunta en el formulario; se conserva para leer leads antiguos. */
export const EXPERIENCE_LABELS: Record<RunningExperience, string> = {
  nunca: "Nunca ha corrido",
  ocasional: "Corre de vez en cuando",
  regular: "Corre regularmente",
  competitivo: "Compite en carreras",
};
