import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/member-auth";

export const dynamic = "force-dynamic";

/**
 * Entrega imágenes privadas de la comunidad vía URL firmada breve.
 * Solo miembros con sesión; la evidencia de retos NO pasa por aquí (esa la ve
 * su dueño en el detalle del reto y el staff en el ERP).
 */
// member-photos y team-photos: los avatares del feed y los comentarios.
const ALLOWED_BUCKETS = new Set(["post-photos", "medal-photos", "member-photos", "team-photos"]);

export async function GET(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const bucket = request.nextUrl.searchParams.get("bucket") ?? "";
  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!ALLOWED_BUCKETS.has(bucket) || !path || path.includes("..")) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data } = await service.storage.from(bucket).createSignedUrl(path, 300);
  if (!data?.signedUrl) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
