"use client";

import { useCallback, useEffect, useState } from "react";
import { completeOnboarding } from "@/app/miembros/community-actions";

interface Step {
  /** data-tour del elemento a iluminar; sin target = tarjeta centrada. */
  target?: string;
  emoji: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    emoji: "👋",
    title: "¡Bienvenido a STRIDE ONE!",
    body: "Este es tu espacio dentro de la comunidad. Te mostramos cómo funciona en un minuto.",
  },
  {
    target: "blog",
    emoji: "📰",
    title: "El Blog",
    body: "Acá vive la comunidad: comparte tus salidas, fotos y logros, y comenta las de los demás. Publicar y comentar suma puntos.",
  },
  {
    target: "habitos",
    emoji: "🔥",
    title: "Tus hábitos",
    body: "Elige hasta 4 hábitos y márcalos cada día desde el Blog. Completarlos arma tu racha y suma puntos.",
  },
  {
    target: "classroom",
    emoji: "🎓",
    title: "Classroom",
    body: "El plan del mes por etapas: clases semana a semana, videos y los recursos del mes.",
  },
  {
    target: "calendario",
    emoji: "📅",
    title: "Calendario",
    body: "Los Social Runs y las sesiones online. Confirma tu asistencia y agrégalos a tu calendario.",
  },
  {
    target: "retos",
    emoji: "🎯",
    title: "Retos",
    body: "Retos del mes, micro-retos e hitos permanentes. Repórtalos y gana puntos y medallas.",
  },
  {
    target: "ranking",
    emoji: "🏆",
    title: "Ranking",
    body: "Parte de cero cada mes y premia la constancia, nunca la velocidad. El Nº1 se lleva premio y medalla.",
  },
  {
    target: "perfil",
    emoji: "🪪",
    title: "Tu perfil",
    body: "Tu carnet, tus medallas y tu configuración: ahí cambias tu nombre y el tema. Empieza presentándote en el Blog 💜",
  },
];

const PAD = 8;

/**
 * Recorrido de bienvenida del primer ingreso: oscurece la pantalla, ilumina la
 * pestaña o el widget de cada paso y explica para qué sirve. Se marca como
 * visto al terminar o al saltarlo, así no vuelve a aparecer en ningún equipo.
 */
export function WelcomeTour({ firstName }: { firstName: string }) {
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [wide, setWide] = useState(false);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const measure = useCallback(() => {
    if (!step.target) return setRect(null);
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) return setRect(null);
    el.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" as ScrollBehavior });
    setRect(el.getBoundingClientRect());
  }, [step.target]);

  useEffect(() => {
    measure();
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    setWide(window.matchMedia("(min-width: 640px)").matches);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [measure]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const finish = () => {
    setOpen(false);
    void completeOnboarding();
  };

  if (!open) return null;

  // La tarjeta va bajo el elemento iluminado en escritorio; en celular es una
  // hoja inferior para no tapar la pestaña.
  const cardStyle: React.CSSProperties | undefined =
    wide && rect
      ? { top: rect.bottom + PAD + 14, left: Math.min(Math.max(rect.left - 20, 16), window.innerWidth - 400) }
      : undefined;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Recorrido de bienvenida">
      {rect ? (
        <div
          key="ring"
          className="pointer-events-none absolute rounded-2xl border-2 border-stride-accent transition-all duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(6,6,10,0.78), 0 0 24px rgba(124,58,237,0.55)",
          }}
        />
      ) : (
        <div key="dim" className="absolute inset-0 bg-[rgba(6,6,10,0.82)]" />
      )}

      <div
        className={
          cardStyle
            ? "m-pagein absolute w-[380px] rounded-3xl border border-[var(--sline)] bg-[var(--scard)] p-5 shadow-2xl"
            : "m-pagein absolute inset-x-4 bottom-6 mx-auto max-w-md rounded-3xl border border-[var(--sline)] bg-[var(--scard)] p-5 shadow-2xl sm:inset-x-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
        }
        style={cardStyle}
      >
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none">{step.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">
              {index + 1} / {STEPS.length}
            </p>
            <h2 className="mt-0.5 font-heading text-lg font-bold leading-tight text-[var(--stext)]">
              {index === 0 ? `¡Bienvenido a STRIDE ONE, ${firstName}!` : step.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--smut)]">{step.body}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                i === index
                  ? "h-1.5 w-5 rounded-full bg-stride-accent transition-all"
                  : "h-1.5 w-1.5 rounded-full bg-[var(--sline2)] transition-all"
              }
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-xs font-semibold text-[var(--sdim)] transition hover:text-[var(--stext)]"
          >
            Saltar recorrido
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="rounded-full border border-[var(--sline2)] px-4 py-2 font-heading text-sm font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]"
              >
                Atrás
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish() : setIndex(index + 1))}
              className="rounded-full bg-stride-accent px-5 py-2 font-heading text-sm font-bold text-white transition hover:bg-stride-accentDark"
            >
              {last ? "¡A correr!" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
