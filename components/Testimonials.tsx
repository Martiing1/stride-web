import { Star } from "lucide-react";
import type { Testimonial } from "@/lib/types";

/**
 * Franja de testimonios que se desliza sola hacia la derecha.
 *
 * La lista se renderiza dos veces seguidas y la animación recorre exactamente
 * la mitad del ancho: al terminar, el segundo juego está donde estaba el
 * primero y el ciclo se reinicia sin salto visible.
 *
 * TODO (v2): reemplazar por testimonios en video.
 */
export function Testimonials({ testimonials }: { testimonials: Testimonial[] }) {
  // Con menos de 3 el bucle se nota. La sección entera desaparece si no hay
  // ninguno publicado: mejor sin testimonios que con testimonios inventados.
  if (testimonials.length === 0) return null;

  const loop = [...testimonials, ...testimonials];

  return (
    <section className="overflow-hidden border-y border-white/5 bg-stride-card/25 py-14">
      <div className="mx-auto max-w-6xl px-5">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-stride-cyan">
          Lo que dice la comunidad
        </p>
      </div>

      <div
        className="group relative mt-8 flex overflow-hidden"
        // Bordes difuminados para que las tarjetas entren y salgan sin corte.
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <ul className="animate-marquee flex shrink-0 gap-4 pr-4 motion-reduce:animate-none">
          {loop.map((t, i) => (
            <li
              key={`${t.id}-${i}`}
              aria-hidden={i >= testimonials.length}
              className="w-[300px] shrink-0 rounded-2xl border border-white/10 bg-stride-card p-5"
            >
              <div className="flex gap-0.5" aria-label={`${t.rating ?? 5} de 5`}>
                {Array.from({ length: 5 }, (_, s) => (
                  <Star
                    key={s}
                    className={`h-3.5 w-3.5 ${
                      s < (t.rating ?? 5)
                        ? "fill-stride-amber text-stride-amber"
                        : "text-white/15"
                    }`}
                  />
                ))}
              </div>

              <blockquote className="mt-3 text-sm leading-relaxed text-white/80">
                “{t.quote}”
              </blockquote>

              <figcaption className="mt-4 flex items-center gap-2.5">
                <span className="gradient-surface flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white">
                  {t.author_name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">
                    {t.author_name}
                  </span>
                  {t.author_role && (
                    <span className="block truncate text-xs text-white/45">{t.author_role}</span>
                  )}
                </span>
              </figcaption>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
