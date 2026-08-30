import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Punto de llegada de los enlaces de acceso que envía Supabase.
 *
 * Supabase puede devolver la sesión de tres formas distintas y cada una hay que
 * atenderla, porque el correo se abre en el dispositivo del miembro y no
 * controlamos con qué cliente se pidió el código:
 *
 * 1. `?token_hash=&type=`  — plantilla con `{{ .TokenHash }}`. Es la única que
 *    funciona aunque el correo se abra en otro navegador o en el visor de Gmail,
 *    porque no depende de nada guardado en el navegador que pidió el código.
 * 2. `?code=`              — PKCE. Sirve solo si el enlace se abre en el mismo
 *    navegador que pidió el código (ahí está el `code_verifier`).
 * 3. `#access_token=`      — flujo implícito, el que usa la invitación enviada
 *    desde el ERP. El fragmento nunca llega al servidor, así que se deriva a
 *    /auth/enlace, que lo lee desde el navegador. El navegador conserva el
 *    fragmento al seguir el redirect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedNext = url.searchParams.get("next");
  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/miembros";

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/miembros/ingresar?error=${reason}`, url.origin));

  // Supabase avisa los errores en la query cuando el enlace ya no sirve.
  const errorCode = url.searchParams.get("error_code") ?? url.searchParams.get("error");
  if (errorCode) {
    return fail(errorCode.includes("expired") ? "vencido" : "enlace");
  }

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail(error.message.toLowerCase().includes("expired") ? "vencido" : "enlace");
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    // El verifier de PKCE vive en el navegador que pidió el código. Si el correo
    // se abrió en otro lado no hay nada que intercambiar: se pide un código nuevo.
    return fail("otro-navegador");
  }

  // Sin parámetros reconocibles: puede ser el flujo implícito, con la sesión en
  // el fragmento. Solo el navegador puede verlo.
  return NextResponse.redirect(
    new URL(`/auth/enlace?next=${encodeURIComponent(next)}`, url.origin)
  );
}
