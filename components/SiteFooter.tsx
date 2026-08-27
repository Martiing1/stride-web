import Link from "next/link";
import { Instagram, MessageCircle } from "lucide-react";
import { SITE, whatsappLink } from "@/lib/site";
import { StrideLogo } from "@/components/StrideLogo";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-stride-bg">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <StrideLogo large />
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              En STRIDE usamos el movimiento para hacer algo que cuesta mucho más en solitario:
              sostener el hábito. Social Runs, experiencias y una comunidad real que te ayuda a
              volver, incluso cuando la semana no salió perfecta.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <Link href="/eventos" className="text-white/60 transition hover:text-white">
              Social Runs
            </Link>
            <Link href="/one" className="text-white/60 transition hover:text-white">
              Membresía STRIDE ONE
            </Link>
            <Link href="/terminos" className="text-white/60 transition hover:text-white">
              Términos y condiciones
            </Link>
            <Link href="/privacidad" className="text-white/60 transition hover:text-white">
              Política de privacidad
            </Link>
          </div>

          <div className="flex gap-3">
            <a
              href={SITE.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram de STRIDE"
              className="rounded-full border border-white/10 p-2.5 text-white/60 transition hover:border-white/30 hover:text-white"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href={whatsappLink("Hola STRIDE, quiero saber más")}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp de STRIDE"
              className="rounded-full border border-white/10 p-2.5 text-white/60 transition hover:border-white/30 hover:text-white"
            >
              <MessageCircle className="h-5 w-5" />
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/5 pt-6 text-xs text-white/25 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} STRIDE · {SITE.city}, Chile</p>
          <p>Datos personales tratados conforme a la normativa chilena aplicable.</p>
        </div>
      </div>
    </footer>
  );
}
