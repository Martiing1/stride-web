/**
 * Ejecuta una consulta a Supabase y devuelve un valor por defecto si falla.
 *
 * Se usa solo en las páginas públicas: si Supabase está caído o no responde, la
 * landing debe seguir mostrándose (con su estado vacío) en vez de devolver un
 * 500. En el ERP no se usa — ahí un error de datos sí tiene que verse.
 */
export async function safeQuery<T>(
  run: () => PromiseLike<{ data: T | null; error: unknown }>,
  fallback: T
): Promise<T> {
  try {
    const { data, error } = await run();
    if (error || data == null) return fallback;
    return data;
  } catch {
    return fallback;
  }
}
