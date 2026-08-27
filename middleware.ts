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
    return NextResponse.rewrite(rewritten);
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

  // Ya autenticado y entrando al login: al dashboard.
  if (isLoginRoute && user) {
    const dashboard = url.clone();
    dashboard.pathname = "/admin";
    dashboard.search = "";
    return NextResponse.redirect(dashboard);
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
