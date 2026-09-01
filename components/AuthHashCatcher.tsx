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
    const path = window.location.pathname;
    // La activación del ERP lee el token ella misma para que la persona pueda
    // crear su contraseña. Mandarla al catcher perdía el destino y terminaba
    // en el flujo de miembros al recargar.
    if (!hash || path.startsWith("/auth/") || path === "/admin/activar" || path === "/activar") return;
    if (!/(?:^|[#&])(access_token|error_code|error)=/.test(hash)) return;

    // Navegación completa, no router.replace: hay que conservar el fragmento
    // y el destino original. Sin `next`, AuthHashSession cae por defecto en
    // /miembros, lo que no corresponde a enlaces del ERP.
    const next = `${path}${window.location.search}`;
    window.location.replace(`/auth/enlace?next=${encodeURIComponent(next)}${hash}`);
  }, []);

  return null;
}
