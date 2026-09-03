import "server-only";
import { createHmac } from "node:crypto";

/**
 * Firma del enlace de baja. Sin ella cualquiera podría dar de baja a otro
 * con solo cambiar el correo en la URL.
 */
export function firmaBaja(email: string): string {
  const secreto = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "stride";
  return createHmac("sha256", secreto).update(`baja:${email.toLowerCase()}`).digest("hex").slice(0, 16);
}
