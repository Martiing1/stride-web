"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Red de seguridad del área de miembros: si una página revienta, la persona
 * ve esto (con el header y las pestañas intactos) en vez de la pantalla
 * genérica "Application error" de Next.
 */
export default function MiembrosError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[miembros]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-4xl">😵‍💫</p>
      <h1 className="mt-4 font-heading text-xl font-bold">Algo se cayó por acá</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--smut)]">
        No fue culpa tuya. Ya quedó registrado para que lo revisemos. Prueba de nuevo y, si sigue igual,
        cuéntanos por WhatsApp.
      </p>
      <div className="mt-6 flex justify-center gap-2.5">
        <button type="button" onClick={reset} className="rounded-full bg-stride-accent px-5 py-2.5 font-heading text-sm font-bold text-white transition hover:bg-stride-accentDark">
          Intentar de nuevo
        </button>
        <Link href="/miembros" className="rounded-full border border-[var(--sline2)] px-5 py-2.5 font-heading text-sm font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]">
          Ir al Blog
        </Link>
      </div>
      {error.digest && <p className="mt-6 font-mono text-[10px] text-[var(--sdim)]">ref {error.digest}</p>}
    </div>
  );
}
