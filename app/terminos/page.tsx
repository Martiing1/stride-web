import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso del sitio, Social Runs y servicios de STRIDE.",
};

export default function TermsPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stride-cyan">
          Acuerdos simples
        </p>
        <h1 className="mt-3 font-heading text-4xl font-extrabold text-white sm:text-5xl">
          Términos y condiciones
        </h1>
        <p className="mt-5 leading-relaxed text-white/65">
          Estos términos regulan el uso de stridechile.cl y la información que publicamos sobre
          Social Runs, STRIDE ONE, convenios y actividades.
        </p>
        <p className="mt-3 text-sm text-white/40">Última actualización: 27 de agosto de 2026.</p>

        <div className="mt-12 space-y-8 text-white/65">
          <section>
            <h2 className="font-heading text-xl font-bold text-white">1. Información del sitio</h2>
            <p className="mt-2 leading-relaxed">
              Procuramos mantener fechas, rutas, cupos, beneficios y precios actualizados. Una
              actividad puede cambiar o cancelarse por clima, seguridad, disponibilidad del equipo
              u otras circunstancias. La confirmación final se informa por los canales de cada evento.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl font-bold text-white">2. Participación en actividades</h2>
            <p className="mt-2 leading-relaxed">
              Cada persona participa de manera voluntaria y debe considerar su estado de salud,
              seguir las indicaciones de seguridad y comunicar cualquier situación relevante. Los
              Social Runs no reemplazan evaluación, tratamiento ni indicación médica profesional.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl font-bold text-white">3. STRIDE ONE y pagos</h2>
            <p className="mt-2 leading-relaxed">
              La membresía se contrata y cobra mediante Skool. El precio, ciclo de cobro,
              cancelación y condiciones vigentes se muestran antes de contratar en esa plataforma.
              Los beneficios de terceros dependen de la disponibilidad y condiciones informadas por
              cada comercio.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl font-bold text-white">4. Enlaces y servicios externos</h2>
            <p className="mt-2 leading-relaxed">
              El sitio puede enlazar a Evently, mapas, redes sociales y comercios asociados.
              Esos servicios operan bajo sus propios términos y políticas; STRIDE no controla su
              disponibilidad ni el tratamiento que realicen fuera de nuestro sitio.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl font-bold text-white">5. Contenido y marca</h2>
            <p className="mt-2 leading-relaxed">
              El nombre STRIDE, sus piezas gráficas, textos, fotografías y materiales pertenecen a
              sus respectivos titulares. No pueden utilizarse comercialmente sin autorización.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-xl font-bold text-white">6. Datos y contacto</h2>
            <p className="mt-2 leading-relaxed">
              El tratamiento de datos se explica en nuestra{" "}
              <a href="/privacidad" className="text-stride-cyan underline underline-offset-2">
                Política de Privacidad
              </a>
              . Para preguntas sobre estos términos puedes escribir a hola@stridechile.cl.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
