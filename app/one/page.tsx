import { ArrowRight, MessageCircle, Users, Target, Sparkles, HeartHandshake } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { BenefitsCatalog } from "@/components/BenefitsCatalog";
import { SITE, whatsappLink } from "@/lib/site";
import type { Benefit } from "@/lib/types";

export const revalidate = 600;

export const metadata = {
  title: "STRIDE ONE — La membresía",
  description:
    "STRIDE ONE: planes de entrenamiento 5K, 10K y 21K, comunidad privada y beneficios en Chile por $31.990 al mes.",
};

const PILLARS = [
  {
    icon: Target,
    title: "Constancia, no rendimiento",
    body: "Micro-retos semanales y un plan que sostiene el hábito cuando se acaba la motivación. El objetivo no es correr más rápido: es no volver a abandonar.",
  },
  {
    icon: Users,
    title: "Una comunidad que te conoce",
    body: "Una comunidad privada donde se habla de lo que cuesta, no solo de los tiempos. Gente que nota cuando desapareces una semana.",
  },
  {
    icon: Sparkles,
    title: "Cabeza y desarrollo personal",
    body: "Clases en vivo, club de lectura y conversaciones sobre disciplina, hábitos y cómo lo que entrenas corriendo se traslada al resto de tu vida.",
  },
  {
    icon: HeartHandshake,
    title: "Beneficios reales en todo Chile",
    body: "Kinesiología, nutrición, deporte, suplementación y cafeterías. Muestras tu tarjeta digital, la escanean y aplicas el beneficio al instante.",
  },
];

const FAQS = [
  {
    question: "¿Los Social Runs siguen siendo gratis?",
    answer:
      "Sí. Los Social Runs son gratuitos y no necesitas ser miembro de STRIDE ONE para participar.",
  },
  {
    question: "¿Necesito tener experiencia corriendo?",
    answer:
      "No. Puedes comenzar desde tu nivel actual. Los planes se adaptan a objetivos de 5K, 10K y 21K.",
  },
  {
    question: "¿Qué incluye la membresía?",
    answer:
      "Planes de entrenamiento, una comunidad privada, clases en vivo, club de lectura, actividades y acceso a beneficios exclusivos.",
  },
  {
    question: "¿Cómo uso los beneficios?",
    answer:
      "Recibes una tarjeta digital con código QR. La presentas en cada comercio asociado y ahí aplican el beneficio vigente.",
  },
  {
    question: "¿Puedo cancelar cuando quiera?",
    answer:
      "Sí. La membresía es mensual y puedes cancelarla cuando quieras, sin permanencia obligatoria.",
  },
];

const WHATSAPP_MESSAGE = "¡Hola cabros! Quiero saber más de la membresía STRIDE ONE.";

export default async function OnePage() {
  const supabase = await createClient();

  const benefits = await safeQuery(
    () => supabase.from("benefits").select("*").eq("active", true).order("sort_order"),
    [] as Benefit[]
  );

  return (
    <>
      <SiteNav />

      <main>
        {/* Hero */}
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
              Membresía
            </span>

            <h1 className="wordmark mt-6 max-w-2xl font-heading text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              STRIDE ONE
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/65">
              Los Social Runs son gratis y siempre lo van a ser. STRIDE ONE es otra cosa: es la capa
              donde se trabaja la constancia, la cabeza y los hábitos. Correr es la excusa; lo que
              se entrena es no rendirse.
            </p>

            <div className="mt-10 flex flex-wrap items-end gap-6">
              <div>
                <p className="font-heading text-5xl font-extrabold text-white">
                  {SITE.membership.priceLabel}
                </p>
                <p className="text-sm text-white/45">CLP al mes · cancela cuando quieras</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/#sumate" className="btn-primary gradient-surface hover:brightness-110">
                  Quiero que me contacten <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={whatsappLink(WHATSAPP_MESSAGE)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  <MessageCircle className="h-4 w-4" />
                  Tengo dudas
                </a>
              </div>
            </div>

          </div>
        </section>

        {/* Pilares */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-heading text-3xl font-extrabold text-white sm:text-4xl">
            Los 4 pilares
          </h2>
          <p className="mt-3 max-w-lg text-white/55">
            Todo lo que incluye la membresía se sostiene en estas cuatro cosas.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
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
        </section>

        {/* Convenios */}
        <section className="border-t border-white/5 bg-stride-card/30">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="font-heading text-3xl font-extrabold text-white sm:text-4xl">
              Alianzas y beneficios en Chile
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

        {/* Preguntas frecuentes */}
        <section className="border-t border-white/5">
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
            <h2 className="max-w-lg font-heading text-3xl font-extrabold leading-tight text-white">
              ¿Te sumas a STRIDE ONE?
            </h2>
            <p className="max-w-md text-white/55">
              Si tienes dudas antes de entrar, escríbenos. Preferimos conversarlo a que te inscribas
              a ciegas.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/#sumate" className="btn-primary gradient-surface hover:brightness-110">
                Quiero que me contacten <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={whatsappLink(WHATSAPP_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                <MessageCircle className="h-4 w-4" />
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
