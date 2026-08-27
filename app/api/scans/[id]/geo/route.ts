import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const GeoSchema = z.object({
  geo_source: z.enum(["gps", "denegado", "no_disponible"]),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy_m: z.number().nonnegative().max(100_000).optional(),
});

/**
 * Completa un escaneo ya registrado con la ubicación del comercio.
 *
 * Endpoint público (el local no tiene sesión), por eso solo permite pasar de
 * 'no_disponible' a un valor definitivo: conociendo un id de escaneo no se
 * puede sobrescribir una ubicación ya guardada ni alterar el resultado de la
 * validación.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = GeoSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { geo_source, lat, lng, accuracy_m } = parsed.data;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("scans")
    .update({
      geo_source,
      lat: geo_source === "gps" ? lat ?? null : null,
      lng: geo_source === "gps" ? lng ?? null : null,
      accuracy_m: geo_source === "gps" ? accuracy_m ?? null : null,
    })
    .eq("id", id)
    .eq("geo_source", "no_disponible");

  if (error) {
    return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
