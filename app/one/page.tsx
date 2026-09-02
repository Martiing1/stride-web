import { ArrowRight, Users, Target, Route, CalendarCheck, Medal, Video, Gift, BookOpen, UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { BenefitsCatalog } from "@/components/BenefitsCatalog";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { SITE, whatsappLink } from "@/lib/site";
import type { Benefit } from "@/lib/types";

export const revalidate = 600;

export const metadata = {
  title: "STRIDE ONE — La membresía",
  description:
    "Deja de empezar de cero. Un plan según tu nivel, un reto cada semana y una comunidad en Concepción por $31.990 al mes, sin permanencia.",
};

/** Los tres pilares del pitch: plan, reto y gente. */
const PILLARS = [
  {
    icon: Route,
    title: "Un plan según tu nivel",
    body: "Sabes qué toca esta semana, partas de cero o ya corras. Tres niveles y tres distancias: 5K, 10K y 21K. El nivel lo eliges tú y puedes subir de un mes a otro.",
  },
  {
    icon: Target,
    title: "Un reto cada semana",
    body: "Micro-retos que te sacan de la zona de confort y te presentan gente. Suman puntos, desbloquean medallas y a fin de mes hay premio para quien más participa.",
  },
  {
    icon: Users,
    title: "Gente esperándote",
    body: "Una comunidad privada donde se habla de lo que cuesta, no solo de los tiempos. Gente que nota cuando desapareces una semana.",
  },
];

/** Las 12 etapas del programa. Etapa 1 arranca en septiembre de 2026. */
const STAGES = [
  "Inicio",
  "Constancia",
  "Técnica",
  "Resistencia",
  "Comunidad",
  "Superación",
  "Reenganche",
  "Velocidad",
  "Experiencia",
  "Desafío",
  "Peak",
  "Cierre",
];
const STAGE_ONE = { year: 2026, month: 9 };

/** Índice de la etapa que corre este mes; se queda en la 12 cuando el ciclo termina. */
function currentStageIndex(now = new Date()): number {
  const months =
    (now.getFullYear() - STAGE_ONE.year) * 12 + (now.getMonth() + 1 - STAGE_ONE.month);
  return Math.min(Math.max(months, 0), STAGES.length - 1);
}

const MONTH_ITEMS = [
  {
    icon: CalendarCheck,
    title: "Cada semana",
    body: "Tu sesión del plan, en el nivel que elijas, más un micro-reto.",
  },
  {
    icon: Medal,
    title: "El reto del mes",
    body: "Se cumple en la calle y con otros, no en el celular. Con medalla al completarlo.",
  },
  {
    icon: Video,
    title: "Tres encuentros en vivo",
    body: "Apertura del mes, club de lectura y cierre. Quedan grabados por si no puedes.",
  },
  {
    icon: UserPlus,
    title: "Social Runs gratuitos",
    body: "Tú sabes el calendario antes de que se publique en Instagram.",
  },
];

const SCREENS = [
  {
    src: "/plataforma/blog.webp",
    alt: "Muro de la comunidad con la racha de hábitos y un Social Run publicado",
    label: "El muro",
    body: "Fotos, logros y presentaciones. Publicar y comentar suma puntos.",
  },
  {
    src: "/plataforma/retos.webp",
    alt: "Pantalla de retos con el reto del mes y los micro-retos de la semana",
    label: "Los retos",
    body: "El reto del mes, los micro-retos de la semana y tu progreso.",
  },
  {
    src: "/plataforma/classroom.webp",
    alt: "Classroom con la etapa del mes, los planes 5K, 10K y 21K y la biblioteca",
    label: "Tu plan",
    body: "La etapa del mes, los tres planes y la biblioteca completa.",
  },
  {
    src: "/plataforma/calendario.webp",
    alt: "Calendario del mes con Social Runs, sesión en vivo y club de lectura",
    label: "El calendario",
    body: "Todo el mes en un lugar. Un toque y queda en el calendario de tu celular.",
  },
];

const KIT = ["Polera STRIDE", "Stickers", "Flyer de bienvenida"];

/** Lo más valorado en el mes piloto, según el acta de cierre. */
const PILOT = [
  {
    icon: Users,
    title: "Salir de la zona de confort",
    body: "Conocer gente e interactuar fue lo más mencionado. Más que lo deportivo.",
  },
  {
    icon: Target,
    title: "Los micro-retos semanales",
    body: "El formato mejor evaluado del mes.",
  },
  {
    icon: BookOpen,
    title: "El club de lectura",
    body: "Varios volvieron a leer después de años.",
  },
];

const FAQS = [
  {
    question: "¿Es mensual o me comprometo por un año?",
    answer:
      "Mensual. El programa está pensado en 12 etapas para que una se apoye en la anterior, pero pagas mes a mes y cada mes decides si sigues. No hay permanencia ni contrato anual.",
  },
  {
    question: "¿Cómo se paga?",
    answer:
      "Nos escribes, conversamos tu punto de partida y ahí coordinamos el pago del mes. No queda nada descontándose solo: cada mes vuelves a decidir.",
  },
  {
    question: "¿Elijo un plan o tengo acceso a los tres?",
    answer:
      "Tienes los tres: 5K, 10K y 21K, cada uno con tres niveles. Entras con tu propia cuenta y eliges el nivel que calce contigo hoy; el mes siguiente puedes subir.",
  },
  {
    question: "¿Sirve si no quiero correr una carrera?",
    answer:
      "Sí. Acá no buscamos deportistas de élite ni marcas. Si lo tuyo es volver a moverte, tener una rutina o simplemente conocer gente, la membresía funciona igual: correr es la excusa.",
  },
  {
    question: "¿Cuántas veces nos juntamos al mes?",
    answer:
      "Tres encuentros en vivo: la apertura del mes, el club de lectura y el cierre. Quedan grabados. Además están los Social Runs, que son abiertos y gratuitos.",
  },
  {
    question: "¿Tengo que vivir en Concepción?",
    answer:
      "Los Social Runs y los encuentros presenciales son en el Gran Concepción. El plan, los retos, la comunidad y las sesiones en vivo son online, así que la membresía te sirve aunque vengas poco o vivas más lejos.",
  },
  {
    question: "Si entro después que otros, ¿me pierdo lo que ya pasó?",
    answer:
      "No. Entras a la etapa que corre este mes y las anteriores quedan abiertas para ti, con sus contenidos y grabaciones. De ahí en adelante avanzas a la par con el resto.",
  },
  {
    question: "¿Los Social Runs siguen siendo gratis?",
    answer:
      "Sí, y siempre lo van a ser. No necesitas ser miembro de STRIDE ONE para ir a un Social Run.",
  },
];

const WHATSAPP_MESSAGE = "¡Hola cabros! Quiero saber más de la membresía STRIDE ONE.";

export default async function OnePage() {
  const supabase = await createClient();

  const benefits = await safeQuery(
    () => supabase.from("benefits").select("*").eq("active", true).order("sort_order"),
    [] as Benefit[]
  );

  const stageIndex = currentStageIndex();

  return (
    <>
      <SiteNav />

      <main>
        {/* Hero: la promesa primero, el nombre después */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 top-0 h-[420px] w-[620px] rounded-full bg-stride-indigo/20 blur-[130px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 top-32 h-[340px] w-[500px] rounded-full bg-stride-cyan/10 blur-[130px]"
          />
          <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-24">
            <span className="inline-flex items-center rounded-full border border-stride-cyan/30 bg-stride-cyan/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-stride-cyan">
              Membresía · STRIDE ONE
            </span>

            <h1 className="mt-6 max-w-3xl font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl">
              Deja de empezar de cero.{" "}
              <span className="wordmark">Esta vez no lo haces solo.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/65">
              Los Social Runs son gratis y siempre lo van a ser. STRIDE ONE es lo que pasa entre uno
              y otro: un plan según tu nivel, un reto cada semana y gente esperándote en Concepción.
            </p>

            <div className="mt-10 flex flex-wrap items-end gap-6">
              <div>
                <p className="font-heading text-5xl font-extrabold text-white">
                  {SITE.membership.priceLabel}
                </p>
                <p className="text-sm text-white/45">CLP al mes · sin permanencia</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/#sumate" className="btn-primary gradient-surface hover:brightness-110">
                  Quiero entrar <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={whatsappLink(WHATSAPP_MESSAGE)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp"
                >
                  <WhatsAppIcon className="h-5 w-5" />
                  Tengo dudas
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* El problema */}
        <section className="border-b border-white/5 bg-stride-card/30">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stride-cyan">
                El problema
              </span>
              <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl">
                No es que no quieras correr. Es que cada lunes vuelves a empezar de cero.
              </h2>
              <p className="mt-5 max-w-xl leading-relaxed text-white/60">
                La motivación dura una o dos semanas. Después cambia la semana, entrenas solo,
                improvisas y lo dejas. No es falta de ganas: falta un siguiente paso claro y alguien
                que te espere.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="card border-white/10">
                <p className="font-heading text-4xl font-extrabold text-stride-cyan">55,1%</p>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  de los adultos en Chile no cumple las recomendaciones de actividad física.
                </p>
              </div>
              <div className="card border-white/10">
                <p className="font-heading text-4xl font-extrabold text-stride-indigo">56%</p>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  abandona antes del año cuando intenta sostener el ejercicio por su cuenta. A los
                  tres meses ya va en 38,8%.
                </p>
              </div>
              <p className="text-xs leading-relaxed text-white/30 sm:col-span-2 lg:col-span-1">
                Cifras de referencia de la OMS y de un estudio de seguimiento sobre adherencia al
                ejercicio.
              </p>
            </div>
          </div>
        </section>

        {/* La promesa: los tres pilares */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stride-cyan">
            La promesa
          </span>
          <h2 className="mt-3 max-w-3xl font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            Entrena con rumbo, sostén el hábito y avanza con tu gente.
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <article key={title} className="card border-white/10">
                <div className="gradient-surface mb-4 inline-flex rounded-xl p-3">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-heading text-xl font-bold text-white">{title}</h3>
                <p className="mt-2 leading-relaxed text-white/65">{body}</p>
              </article>
            ))}
          </div>

          <p className="mt-10 font-heading text-xl font-bold leading-snug text-stride-indigo sm:text-2xl">
            No vas a depender de tu motivación. Vas a depender del sistema y de la gente.
          </p>
        </section>

        {/* Cómo es un mes */}
        <section className="border-y border-white/5 bg-stride-card/30">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stride-cyan">
              Por dentro
            </span>
            <h2 className="mt-3 font-heading text-3xl font-extrabold text-white sm:text-4xl">
              Así se ve un mes en STRIDE ONE
            </h2>
            <p className="mt-3 max-w-2xl text-white/55">
              Un programa de 12 etapas con un foco por mes. Cada etapa se apoya en la anterior, pero
              se paga mes a mes: nunca firmas por un año.
            </p>

            <ol className="mt-8 flex flex-wrap gap-2">
              {STAGES.map((stage, i) => {
                const isCurrent = i === stageIndex;
                return (
                  <li
                    key={stage}
                    aria-current={isCurrent ? "step" : undefined}
                    className={
                      isCurrent
                        ? "rounded-full bg-stride-accent px-4 py-2 text-sm font-semibold text-white"
                        : "rounded-full border border-white/10 px-4 py-2 text-sm text-white/45"
                    }
                  >
                    {stage}
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-sm font-semibold text-stride-cyan">
              Etapa en curso: {STAGES[stageIndex]}
            </p>

            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {MONTH_ITEMS.map(({ icon: Icon, title, body }) => (
                <article
                  key={title}
                  className="flex gap-4 rounded-2xl border border-white/5 bg-stride-bg/40 p-5"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stride-cyan/30 bg-stride-cyan/5">
                    <Icon className="h-5 w-5 text-stride-cyan" />
                  </span>
                  <div>
                    <h3 className="font-heading font-bold text-white">{title}</h3>
                    <p className="mt-1 leading-relaxed text-white/60">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* La plataforma */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stride-cyan">
            La plataforma
          </span>
          <h2 className="mt-3 max-w-2xl font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            Tu gente sigue ahí entre encuentro y encuentro
          </h2>
          <p className="mt-3 max-w-2xl text-white/55">
            Todo vive en un solo lugar, hecho por nosotros y pensado para el celular. Entras con tu
            correo, sin instalar nada.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {SCREENS.map(({ src, alt, label, body }) => (
              <figure key={label} className="flex flex-col">
                <div className="rounded-[1.6rem] border border-white/10 bg-stride-bg p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
                  <Image
                    src={src}
                    alt={alt}
                    width={780}
                    height={1688}
                    sizes="(min-width: 1024px) 260px, (min-width: 640px) 45vw, 80vw"
                    className="h-auto w-full rounded-[1.25rem]"
                  />
                </div>
                <figcaption className="mt-4">
                  <h3 className="font-heading font-bold text-white">{label}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">{body}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Kit de bienvenida */}
        <section className="border-y border-white/5 bg-stride-card/30">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stride-cyan">
                Tu primera semana
              </span>
              <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl">
                El kit de bienvenida llega apenas entras
              </h2>
              <p className="mt-4 max-w-lg leading-relaxed text-white/60">
                No al final del mes: en tu primera semana, para que lo uses desde el primer Social
                Run.
              </p>
            </div>

            <ul className="flex flex-wrap gap-3">
              {KIT.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-white/5 bg-stride-bg/40 px-5 py-4 text-white/85"
                >
                  <Gift className="h-5 w-5 shrink-0 text-stride-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Convenios */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stride-cyan">
              Beneficios
            </span>
            <h2 className="mt-3 font-heading text-3xl font-extrabold text-white sm:text-4xl">
              Descuentos que ayudan a pagar la membresía
            </h2>
            <p className="mt-3 max-w-xl text-white/55">
              Como miembro recibes una tarjeta digital con tu código QR. La muestras en el local, la
              escanean con la cámara del celular y aplican tu beneficio al instante.
            </p>

            <div className="mt-12">
              <BenefitsCatalog benefits={benefits} />
            </div>
          </div>
        </section>

        {/* Prueba del piloto */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stride-cyan">
            El mes piloto
          </span>
          <h2 className="mt-3 max-w-3xl font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            Lo probamos un mes con gente de la comunidad. Esto fue lo que más valoraron.
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PILOT.map(({ icon: Icon, title, body }) => (
              <article key={title} className="card border-white/10">
                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-stride-indigo/40 bg-stride-indigo/10">
                  <Icon className="h-5 w-5 text-stride-indigo" />
                </span>
                <h3 className="font-heading text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 leading-relaxed text-white/65">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Preguntas frecuentes */}
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-4xl px-5 py-20">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stride-cyan">
                Preguntas frecuentes
              </span>
              <h2 className="mt-3 font-heading text-3xl font-extrabold text-white sm:text-4xl">
                Lo importante, antes de sumarte
              </h2>
            </div>

            <div className="mt-10 space-y-3">
              {FAQS.map(({ question, answer }) => (
                <details
                  key={question}
                  className="group rounded-2xl border border-white/10 bg-stride-card px-5 py-1 open:border-stride-indigo/60"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-heading font-semibold text-white marker:content-none">
                    {question}
                    <span
                      aria-hidden
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-lg text-stride-cyan transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="border-t border-white/5 pb-5 pt-4 leading-relaxed text-white/60">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="card flex flex-col items-center gap-5 py-14 text-center">
            <h2 className="max-w-xl font-heading text-3xl font-extrabold leading-tight text-white">
              Deja de empezar de cero
            </h2>
            <p className="max-w-md text-white/55">
              {SITE.membership.priceLabel} al mes, sin permanencia. Si tienes dudas antes de entrar,
              escríbenos: preferimos conversarlo a que te inscribas a ciegas.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/#sumate" className="btn-primary gradient-surface hover:brightness-110">
                Quiero entrar <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={whatsappLink(WHATSAPP_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp"
              >
                <WhatsAppIcon className="h-5 w-5" />
                {SITE.whatsappLabel}
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
