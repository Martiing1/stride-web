"use client";

import { useEffect } from "react";

/**
 * Red de seguridad para los enlaces de acceso.
 *
 * Si la URL de retorno del correo no está en la lista blanca de Supabase, el
 * enlace aterriza en el Site URL —la landing— con la sesión colgando del
 * fragmento. Sin esto el miembro ve la portada y cree que el enlace falló.
 * Solo actúa cuando hay tokens en el fragmento; en cualquier otra visita no
 * hace nada.
 */
export function AuthHashCatcher() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || window.location.pathname.startsWith("/auth/")) return;
    if (!/(?:^|[#&])(access_token|error_code|error)=/.test(hash)) return;

    // Navegación completa, no router.replace: hay que conservar el fragmento.
    window.location.replace(`/auth/enlace${hash}`);
  }, []);

  return null;
}
