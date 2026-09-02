"use client";

import { useEffect } from "react";

/** Red de seguridad del sitio público (landing, carnet, validación de QR). */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[site]", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center text-white">
      <h1 className="font-heading text-2xl font-extrabold">Algo salió mal</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
        Ya quedó registrado. Prueba de nuevo en un momento.
      </p>
      <button type="button" onClick={reset} className="mt-6 rounded-full bg-stride-accent px-6 py-2.5 font-heading text-sm font-bold text-white">
        Intentar de nuevo
      </button>
      {error.digest && <p className="mt-6 font-mono text-[11px] text-white/30">ref {error.digest}</p>}
    </main>
  );
}
