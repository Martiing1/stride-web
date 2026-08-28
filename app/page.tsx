import Link from "next/link";
import { ArrowRight, Ticket, Footprints, PartyPopper, Check, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Hero } from "@/components/Hero";
import { EventAgenda } from "@/components/EventAgenda";
import { Testimonials } from "@/components/Testimonials";
import { LeadForm } from "@/components/LeadForm";
import { SITE } from "@/lib/site";
import { todayInChile } from "@/lib/membership";
import { isDev, DEV_EVENTS, DEV_TESTIMONIALS } from "@/lib/dev-placeholders";
import type { StrideEvent, Testimonial } from "@/lib/types";

export const revalidate = 300;

const STEPS = [
  {
    icon: Ticket,
    title: "Reservas tu cupo",
    body: "Tomas tu ticket online y te llega el punto de encuentro. El día del evento llegas, te escaneamos el ticket y estás dentro. Eso es todo el trámite.",
  },
  {
    icon: Footprints,
    title: "Corres a tu ritmo",
    body: "La distancia y la ruta van cambiando en cada fecha. Antes de salir te contamos el recorrido y armamos ritmos para que puedas avanzar acompañado.",
  },
  {
    icon: PartyPopper,
    title: "Se arma lo bueno",
    body: "La metodología STRIDE pone a la persona antes que la competencia. Antes y después de correr generamos espacios para conocernos, jugar y compartir: el hábito también se sostiene sintiéndote parte.",
  },
];

const ONE_PERKS = [
  "Comunidad cerrada",
  "Beneficios y convenios en todo Chile",
  "Planes de entrenamiento 5K, 10K y 21K",
  "Clases en vivo y club de lectura",
  "Regalos, sorteos y kit de bienvenida",
  "Descuentos en retiros y viajes a maratones",
];

export default async function HomePage() {
  const supabase = await createClient();
  const today = todayInChile();

  const [dbEvents, dbTestimonials] = await Promise.all([
    safeQuery(
      () =>
        supabase
          .from("events")
          .select("*")
          .eq("is_public", true)
          .eq("status", "confirmado")
          .gte("event_date", today)
          .order("event_date")
          .limit(3),
      [] as StrideEvent[]
    ),
    safeQuery(
      () =>
        supabase
          .from("testimonials")
          .select("*")
          .eq("published", true)
          .order("sort_order")
          .limit(3),
      [] as Testimonial[]
    ),
  ]);

  // Sin datos reales (Supabase aún no conectado) se usan muestras, pero solo
  // en desarrollo: en producción la sección se esconde antes que inventar.
  const events = dbEvents.length > 0 || !isDev ? dbEvents : DEV_EVENTS;
  const testimonials =
    dbTestimonials.length > 0 || !isDev ? dbTestimonials : DEV_TESTIMONIALS;

  return (
    <>
      <SiteNav />

      <main>
        <Hero />

        {/* Próximos encuentros — el core: es lo que convierte */}
        <section id="encuentros" className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stride-cyan">
            Agenda STRIDE
          </p>
          <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            Próximos encuentros
          </h2>
          <p className="mt-3 max-w-lg text-white/65">
            Gratis y abiertos. Reservas tu cupo, llegas y corres. Eso es todo.
          </p>

          <div className="mt-10">
            <EventAgenda events={events} />
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="border-y border-white/5 bg-stride-card/25">
          <div className="mx-auto max-w-5xl px-5 py-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stride-cyan">
              Simplicidad
            </p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold text-white sm:text-4xl">
              Cómo funcionan los Social Runs
            </h2>
          <p className="mt-3 max-w-lg text-white/65">
              En cada fecha nos dividimos en tres grupos para correr a ritmos distintos. Tú eliges
              dónde sentirte cómodo y avanzas acompañado, sin importar tu nivel.
            </p>

            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="card border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="gradient-surface inline-flex rounded-xl p-2.5">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="wordmark font-heading text-3xl font-extrabold">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-4 font-heading text-xl font-bold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-10">
              <Link href="#sumate" className="btn-primary">
                Quiero venir al próximo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* STRIDE ONE — la capa de arriba, no el centro de la página */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
          <div className="gradient-border">
            <div className="grid gap-10 rounded-3xl bg-stride-bg p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-stride-indigo/30 bg-stride-indigo/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-indigo-200">
                  <Sparkles className="h-3 w-3" />
                  El siguiente paso
                </span>

                <h2 className="mt-5 font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl">
                  Los Social Runs son gratis.
                  <br />
                  <span className="wordmark">{SITE.membership.name} es lo que sigue.</span>
                </h2>

                <p className="mt-5 max-w-md leading-relaxed text-white/70">
                  Un Social Run es una tarde. La membresía es lo que viene después: acá encuentras
                  una <strong className="font-semibold text-white underline decoration-stride-cyan/80 decoration-2 underline-offset-4">comunidad exclusiva</strong>,
                  la continuidad, la gente que te espera cada semana y los beneficios de ser parte
                  de STRIDE todo el año.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-5">
                  <Link
                    href="#sumate"
                    className="btn-primary btn-shine gradient-surface shadow-[0_0_24px_rgba(99,102,241,0.3)] hover:brightness-110"
                  >
                    Quiero que me contacten <ArrowRight className="h-4 w-4" />
                  </Link>
                  <span className="font-heading text-xl font-bold text-white">
                    {SITE.membership.priceLabel}
                    <span className="text-sm font-normal text-white/50"> /mes</span>
                  </span>
                </div>
              </div>

              <ul className="space-y-3">
                {ONE_PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-3 rounded-xl bg-white/5 p-4">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-stride-cyan" />
                    <span className="text-sm text-white/85">{perk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <Testimonials testimonials={testimonials} />

        {/* Captura */}
        <section id="sumate">
          <div className="mx-auto grid max-w-5xl gap-12 px-5 py-20 lg:grid-cols-2 lg:items-start">
            <div className="lg:sticky lg:top-24">
              <h2 className="wordmark font-heading text-3xl font-extrabold leading-tight sm:text-4xl">
                Da el primer paso
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-white/70">
                A veces quieres empezar, pero hacerlo solo convierte el movimiento en otra tarea
                que cuesta sostener. Cuéntanos si buscas venir a un Social Run, recuperar la
                constancia o conocer {SITE.membership.name}; así podremos contactarte con el
                siguiente paso que realmente calce contigo.
              </p>
            </div>

            <LeadForm source="landing" />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
