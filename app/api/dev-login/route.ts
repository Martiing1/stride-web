import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * SOLO DESARROLLO: inicia sesión como un email dado sin pasar por el correo
 * OTP, para poder probar el área de miembros en localhost.
 *
 * Doble candado: (1) fuera de `next dev` responde 404 — en producción
 * (`next build`/Vercel) NODE_ENV es "production" y esta ruta no existe a
 * efectos prácticos; (2) solo funciona para emails que terminan en
 * `+dev@stridechile.cl` o el email de prueba, nunca cuentas reales.
 */
export async function GET(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  if (process.env.NODE_ENV !== "development" || (hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.endsWith(".localhost"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const email = (request.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  const allowed = email.endsWith("+dev@stridechile.cl") || email === "prueba.comunidad@stridechile.cl";
  if (!allowed) {
    return NextResponse.json({ error: "Email de prueba no permitido" }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link?.properties?.hashed_token) {
    return NextResponse.json({ error: linkError?.message ?? "No se pudo generar el link" }, { status: 500 });
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  const next = request.nextUrl.searchParams.get("next") ?? "/miembros";
  const origin = `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
  return NextResponse.redirect(new URL(next, origin));
}
