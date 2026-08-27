import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo STRIDE recopila, utiliza y protege tus datos personales.",
};

const sections = [
  {
    title: "1. Quién trata tus datos",
    body: "El responsable es STRIDE, comunidad con operación en Concepción, Chile. Para consultas, solicitudes o para retirar una autorización puedes escribir a hola@stridechile.cl.",
  },
  {
    title: "2. Qué datos recopilamos",
    body: "En los formularios de contacto podemos solicitar nombre, email, número de WhatsApp, motivación de contacto y la evidencia de las autorizaciones otorgadas. Si participas como miembro o en un evento, podremos tratar además los datos necesarios para gestionar esa relación.",
  },
  {
    title: "3. Para qué los usamos",
    body: "Usamos tus datos para responder tu solicitud, orientarte sobre Social Runs o STRIDE ONE y gestionar tu participación. Solo si marcas la autorización opcional podremos enviarte novedades, actividades y comunicaciones promocionales por WhatsApp o email.",
  },
  {
    title: "4. Base y evidencia del tratamiento",
    body: "Recabamos un consentimiento previo, informado y específico para cada finalidad que lo requiera. Registramos la versión y fecha de la autorización para poder demostrarla. Puedes retirarla en cualquier momento, sin afectar el tratamiento realizado antes de la revocación.",
  },
  {
    title: "5. Proveedores y transferencias",
    body: "Podemos usar proveedores tecnológicos estrictamente necesarios para operar el sitio, alojar la base de datos, enviar avisos y responder mensajes, como Vercel, Supabase, Resend, WhatsApp/Meta y Skool. Algunos pueden procesar información fuera de Chile bajo sus propias medidas de seguridad y contratos aplicables.",
  },
  {
    title: "6. Conservación y seguridad",
    body: "Conservamos los datos mientras atendemos la finalidad informada o exista una relación activa. Los contactos sin actividad se eliminan o anonimizan, como regla general, después de 24 meses desde la última interacción, salvo que una obligación legal exija conservarlos. Aplicamos controles de acceso y medidas técnicas razonables para evitar pérdida, acceso o uso no autorizado.",
  },
  {
    title: "7. Tus derechos",
    body: "Puedes solicitar información sobre el tratamiento de tus datos, acceso, rectificación, supresión, oposición, portabilidad o bloqueo cuando corresponda. También puedes retirar tu autorización gratuitamente escribiendo a hola@stridechile.cl. Verificaremos tu identidad antes de gestionar una solicitud para no entregar datos a terceros.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stride-cyan">
          Privacidad en claro
        </p>
        <h1 className="mt-3 font-heading text-4xl font-extrabold text-white sm:text-5xl">
          Política de privacidad
        </h1>
        <p className="mt-5 leading-relaxed text-white/65">
          Tus datos sirven para conversar contigo y gestionar tu relación con STRIDE, no para
          acumular contactos sin propósito. Esta política explica qué hacemos y cómo puedes
          decidir sobre tu información.
        </p>
        <p className="mt-3 text-sm text-white/40">Última actualización: 27 de agosto de 2026.</p>

        <div className="mt-12 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-heading text-xl font-bold text-white">{section.title}</h2>
              <p className="mt-2 leading-relaxed text-white/65">{section.body}</p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
