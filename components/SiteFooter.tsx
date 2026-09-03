import Link from "next/link";
import { Instagram, LogIn, ShieldCheck } from "lucide-react";
import { SITE, whatsappLink } from "@/lib/site";
import { StrideLogo } from "@/components/StrideLogo";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-stride-bg">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <StrideLogo large />
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Social Runs, experiencias y una comunidad que te ayuda a sostener el hábito.
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

            {/* Accesos. El del equipo apunta al subdominio a propósito: el
                dominio público no sirve /admin (lo devuelve a la portada). */}
            <span className="mt-4 border-t border-white/5 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/25">
              Accesos
            </span>
            <Link
              href="/miembros/ingresar"
              className="flex items-center gap-2 text-white/60 transition hover:text-white"
            >
              <LogIn className="h-3.5 w-3.5" /> Área de miembros
            </Link>
            <a
              href={SITE.adminUrl}
              className="flex items-center gap-2 text-white/60 transition hover:text-white"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Acceso del equipo
            </a>
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
              href={whatsappLink("¡Hola cabros! Quiero saber más de STRIDE.")}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp de STRIDE"
              className="rounded-full bg-[#25d366] p-2.5 text-white shadow-[0_0_18px_rgba(37,211,102,0.2)] transition hover:bg-[#20bd5a]"
            >
              <WhatsAppIcon className="h-5 w-5" />
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
