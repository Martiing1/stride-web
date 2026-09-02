"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Red de seguridad del ERP: el módulo que falló muestra esto, el resto del panel sigue usable. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="font-heading text-2xl font-extrabold text-white">Este módulo falló al cargar</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        El resto del ERP sigue funcionando. Reintenta; si vuelve a pasar, avísale a Martín con la referencia de
        abajo para ubicar el error en los registros.
      </p>
      <div className="mt-6 flex justify-center gap-2.5">
        <button type="button" onClick={reset} className="btn-primary px-5 py-2.5 text-sm">
          Reintentar
        </button>
        <Link href="/admin" className="rounded-full border border-white/15 px-5 py-2.5 font-heading text-sm font-semibold text-white/70 transition hover:bg-white/5">
          Volver al dashboard
        </Link>
      </div>
      {error.digest && <p className="mt-6 font-mono text-[11px] text-white/30">ref {error.digest}</p>}
    </div>
  );
}
