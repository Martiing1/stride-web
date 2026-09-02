"use client";

import { useEffect, useState } from "react";

/**
 * Red de seguridad para acciones que fallan fuera de un límite de error:
 * si una promesa queda sin manejar (una Server Action que reventó, la red
 * que se cayó a mitad de un guardado), la persona ve un aviso claro en vez
 * de un botón que no hace nada. No reemplaza los mensajes propios de cada
 * formulario; solo cubre lo inesperado.
 */
export function GlobalErrorToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 6000);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      // Las cancelaciones de navegación de Next no son errores del usuario.
      const text = String(event.reason ?? "");
      if (/NEXT_REDIRECT|NEXT_NOT_FOUND|AbortError/.test(text)) return;
      show();
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-5 z-[70] mx-auto max-w-md rounded-2xl border border-red-500/30 bg-[#1a0f14] px-4 py-3 text-sm text-red-100 shadow-2xl"
    >
      <p className="font-heading font-bold">Algo falló al guardar</p>
      <p className="mt-0.5 text-xs text-red-200/80">No se aplicó el último cambio. Revisa tu conexión e intenta de nuevo.</p>
      <button type="button" onClick={() => setVisible(false)} className="absolute right-3 top-2.5 text-red-200/60 hover:text-red-100" aria-label="Cerrar">
        ×
      </button>
    </div>
  );
}
