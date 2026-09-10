"use client";

import { useId } from "react";
import clsx from "clsx";
import { MEDAL_STOPS, type MedalRarity } from "@/lib/share-card";

/**
 * Medalla dibujada: disco metálico según rareza, cinta con el degradado de
 * marca y el emoji del catálogo grabado al centro. Reemplaza al emoji suelto
 * en la vitrina, los hitos y el popup de reto cumplido.
 */
export function MedalBadge({
  rarity,
  emoji,
  size = 64,
  muted = false,
  className,
}: {
  rarity: MedalRarity | string;
  emoji: string;
  size?: number;
  /** Bloqueada o en revisión: se ve en gris y apagada. */
  muted?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [light, mid, dark] = MEDAL_STOPS[(rarity as MedalRarity) in MEDAL_STOPS ? (rarity as MedalRarity) : "oro"];

  return (
    <svg
      viewBox="0 0 100 118"
      width={size}
      height={Math.round(size * 1.18)}
      className={clsx(muted && "opacity-45 grayscale", className)}
      aria-label={`Medalla de ${rarity}`}
      role="img"
    >
      <defs>
        <linearGradient id={`${id}-rl`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00E5FF" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id={`${id}-rr`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
        <radialGradient id={`${id}-disc`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>

      {/* Cinta: dos tiras que bajan por detrás del disco */}
      <polygon points="31,0 47,0 57,36 41,42" fill={`url(#${id}-rl)`} />
      <polygon points="53,0 69,0 59,42 43,36" fill={`url(#${id}-rr)`} />
      <polygon points="47,0 53,0 50,14" fill="rgba(0,0,0,0.25)" />

      {/* Disco */}
      <circle cx="50" cy="74" r="38" fill={`url(#${id}-rim)`} />
      <circle cx="50" cy="74" r="34.5" fill={`url(#${id}-disc)`} />
      <circle cx="50" cy="74" r="28" fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="1.6" />
      <circle cx="50" cy="74" r="28" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" strokeDasharray="60 116" transform="rotate(-140 50 74)" />
      {/* Brillo */}
      <ellipse cx="38" cy="58" rx="12" ry="7" fill="rgba(255,255,255,0.28)" transform="rotate(-30 38 58)" />

      <text x="50" y="75.5" textAnchor="middle" dominantBaseline="central" fontSize="30" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))" }}>
        {emoji}
      </text>
    </svg>
  );
}

/** Etiqueta legible de la rareza. */
export const RARITY_LABEL: Record<string, string> = { oro: "Oro", plata: "Plata", bronce: "Bronce" };

/** Color sólido de la rareza para textos y sombras (el tono medio del metal). */
export function medalColor(rarity: string | null | undefined): string {
  const key = rarity && rarity in MEDAL_STOPS ? (rarity as MedalRarity) : "oro";
  return MEDAL_STOPS[key][1];
}

/** Normaliza la rareza que viene de la BD como string. */
export function asRarity(rarity: string | null | undefined): MedalRarity | null {
  return rarity && rarity in MEDAL_STOPS ? (rarity as MedalRarity) : null;
}
