import { createBrowserClient } from "@supabase/ssr";

// Cliente de Supabase para uso en componentes de cliente (browser).
// Usa la anon key: solo puede leer lo que las políticas RLS permiten a público/autenticado.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
