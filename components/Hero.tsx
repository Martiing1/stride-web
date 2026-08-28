import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronDown } from "lucide-react";
import { SITE } from "@/lib/site";

/**
 * Hero de la landing.
 *
 * Foto real de fondo con un doble overlay: uno oscuro para que el texto se lea
 * siempre (aunque la foto sea clara o cargada) y otro con el degradado de marca
 * a baja opacidad para teñirla. Si la foto no existe, el fondo degradado que
 * queda debajo sostiene la sección por sí solo.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-[88vh] items-center justify-center overflow-hidden">
      {/*
        Fondo. Va con z-0, no con z negativo: el body tiene su propio color y
        un -z-10 acá deja la foto pintada por detrás de ese fondo, invisible.
      */}
      <div aria-hidden className="absolute inset-0 z-0">
        {/* Se ve si la foto tarda o falla en cargar. */}
        <div className="absolute inset-0 bg-gradient-to-br from-stride-indigo/30 via-stride-bg to-stride-bg" />

        <Image
          src={SITE.heroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_55%]"
        />

        {/*
          Capas sobre la foto. Es un grupo grande a plena luz: sin esto el
          texto se pierde entre las caras, pero de más se pierde la foto.
          - base pareja para bajar el brillo
          - degradado vertical que ancla el nav arriba y la transición abajo
          - scrim suave detrás del bloque de texto
          - tinte de marca
        */}
        <div className="absolute inset-0 bg-stride-bg/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-stride-bg/90 via-stride-bg/10 to-stride-bg" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 48% at 50% 45%, rgba(10,10,10,0.72) 0%, rgba(10,10,10,0.38) 62%, transparent 92%)",
          }}
        />
        <div className="gradient-surface absolute inset-0 opacity-[0.15] mix-blend-overlay" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-4xl px-5 py-24 text-center">
        <h1 className="font-heading text-5xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-7xl">
          <span className="text-on-photo">Correr es la excusa</span>
          <br />
          {/*
            El degradado usa bg-clip-text con color transparente: un
            text-shadow se vería A TRAVÉS de las letras y ensuciaría el
            degradado. Sobre texto recortado hay que usar drop-shadow.
          */}
          <span className="wordmark italic [filter:drop-shadow(0_2px_10px_rgba(10,10,10,0.9))]">
            para socializar.
          </span>
        </h1>

        <p className="text-on-photo mx-auto mt-7 max-w-xl text-lg leading-relaxed text-white/90">
          Nos juntamos cada semana a correr por {SITE.city}. Gratis, sin nivel mínimo y sin
          tener que conocer a nadie para llegar.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="#encuentros"
            className="btn-primary gradient-surface shadow-[0_0_24px_rgba(99,102,241,0.3)] hover:brightness-110"
          >
            Ver próximos encuentros <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/one" className="btn-secondary backdrop-blur-sm">
            Conocer {SITE.membership.name}
          </Link>
        </div>

        <dl className="mx-auto mt-14 flex max-w-lg items-start justify-center divide-x divide-white/15">
          {[
            { value: SITE.stats.members, label: "Miembros" },
            { value: SITE.stats.events, label: "Eventos" },
            { value: SITE.stats.years, label: "En Concepción" },
          ].map((stat, index) => (
            <div key={stat.label} className="px-7">
              <dt
                className="stat-gradient-flow font-heading text-3xl font-extrabold sm:text-4xl"
                style={{ animationDelay: `${index * -8}s` }}
              >
                {stat.value}
              </dt>
              <dd className="mt-1 text-[11px] uppercase tracking-widest text-white/50">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <ChevronDown
        aria-hidden
        className="absolute bottom-7 left-1/2 z-10 h-5 w-5 -translate-x-1/2 animate-bounce text-white/40"
      />
    </section>
  );
}
