import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Hace dos cosas:
 *
 * 1. Enrutado por subdominio: admin.stridechile.cl sirve las rutas /admin/*
 *    del mismo proyecto, sin que el usuario tenga que escribir /admin.
 * 2. Protege el ERP: sin sesión de Supabase, redirige al login.
 *
 * La verificación de ROL (socio / líder / monitor) no se hace acá sino en cada
 * página y en las políticas RLS de Postgres: el middleware solo confirma que
 * hay una sesión válida.
 */
export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const isAdminHost = host.startsWith("admin.");

  // El ERP se entrega solo en admin.stridechile.cl. No dejamos una segunda
  // puerta visible en el dominio público: /admin/* vuelve a la portada. La
  // activación es la excepción mínima, porque recibe un enlace de un solo uso
  // para que una persona cree su contraseña antes de entrar al subdominio.
  if (!isAdminHost && url.pathname.startsWith("/admin") && url.pathname !== "/admin/activar") {
    const home = url.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-stride-pathname", url.pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca la sesión. Debe ir antes de cualquier redirect.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Subdominio admin: reescribe / -> /admin ---
  if (isAdminHost && !url.pathname.startsWith("/admin")) {
    const rewritten = url.clone();
    rewritten.pathname = `/admin${url.pathname === "/" ? "" : url.pathname}`;

    const isPublicAdminEntry =
      rewritten.pathname.startsWith("/admin/login") ||
      rewritten.pathname.startsWith("/admin/activar");

    if (!user && !isPublicAdminEntry) {
      const login = url.clone();
      login.pathname = "/admin/login";
      return NextResponse.redirect(login);
    }

    // El layout del ERP decide con esta cabecera si la ruta exige sesión. Tiene
    // que llevar la ruta YA reescrita: en este host el pathname original es
    // /activar, no /admin/activar, y sin esto la activación pide login.
    requestHeaders.set("x-stride-pathname", rewritten.pathname);
    return NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } });
  }

  // --- Acceso directo a /admin en el dominio principal ---
  const isAdminRoute = url.pathname.startsWith("/admin");
  const isLoginRoute = url.pathname.startsWith("/admin/login");
  const isActivationRoute = url.pathname.startsWith("/admin/activar");

  if (isAdminRoute && !isLoginRoute && !isActivationRoute && !user) {
    const login = url.clone();
    login.pathname = "/admin/login";
    login.searchParams.set("next", url.pathname);
    return NextResponse.redirect(login);
  }

  // Una sesión de miembro no cuenta como acceso al ERP. Solo se salta el
  // login si la cuenta autenticada pertenece realmente al equipo.
  if (isLoginRoute && user) {
    const { data: teamMember } = await supabase
      .from("team_members")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("status", "activo")
      .maybeSingle();

    if (teamMember) {
      const dashboard = url.clone();
      dashboard.pathname = "/admin";
      dashboard.search = "";
      return NextResponse.redirect(dashboard);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todo salvo estáticos e imágenes. /validar y /tarjeta pasan por acá para
     * refrescar cookies, pero son públicas y el middleware no las bloquea.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
