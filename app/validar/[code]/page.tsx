import { headers } from "next/headers";
import Image from "next/image";
import { CheckCircle2, XCircle, MapPin, ShieldCheck } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { isMembershipValid, formatDateCL } from "@/lib/membership";
import { ScanGeoReporter } from "@/components/ScanGeoReporter";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Validar membresía",
  robots: { index: false, follow: false },
};

/**
 * Página que abre la cámara del celular del comercio al escanear el QR de un
 * miembro. Es 100% pública y sin login: el local no instala nada.
 *
 * Cada visita queda registrada en `scans`, tenga o no geolocalización.
 */
export default async function ValidarPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const memberCode = decodeURIComponent(code).toUpperCase();

  // Service role: la tabla members no es legible con la anon key.
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("members")
    .select("id, full_name, photo_url, status, valid_until, joined_at")
    .eq("member_code", memberCode)
    .maybeSingle();

  const member = data as Pick<
    Member,
    "id" | "full_name" | "photo_url" | "status" | "valid_until" | "joined_at"
  > | null;

  const valid = member ? isMembershipValid(member) : false;

  // Se registra el escaneo de inmediato, sin esperar la ubicación: si el local
  // niega el permiso el registro igual queda. ScanGeoReporter lo completa
  // después con las coordenadas si el navegador las entrega.
  const userAgent = (await headers()).get("user-agent");
  const { data: scan } = await supabase
    .from("scans")
    .insert({
      member_id: member?.id ?? null,
      member_code: memberCode,
      was_valid: valid,
      geo_source: "no_disponible",
      user_agent: userAgent,
    })
    .select("id")
    .single();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-stride-bg px-5 py-10">
      <div className="w-full max-w-md">
        <div
          className={`overflow-hidden rounded-3xl border-2 ${
            valid ? "border-emerald-500 bg-emerald-500/10" : "border-red-500 bg-red-500/10"
          }`}
        >
          {/* Veredicto: legible de un vistazo y a distancia */}
          <div
            className={`flex flex-col items-center gap-3 px-6 py-8 text-center ${
              valid ? "bg-emerald-500" : "bg-red-500"
            }`}
          >
            {valid ? (
              <CheckCircle2 className="h-16 w-16 text-white" strokeWidth={2.5} />
            ) : (
              <XCircle className="h-16 w-16 text-white" strokeWidth={2.5} />
            )}
            <p className="font-heading text-3xl font-extrabold uppercase leading-tight text-white">
              {valid ? "Membresía válida" : member ? "Membresía no vigente" : "Código no válido"}
            </p>
            {valid && (
              <p className="text-sm font-medium text-white/90">
                Puedes aplicar el beneficio STRIDE
              </p>
            )}
          </div>

          {member ? (
            <div className="flex flex-col items-center gap-4 px-6 py-8">
              {member.photo_url ? (
                <Image
                  src={member.photo_url}
                  alt={member.full_name}
                  width={128}
                  height={128}
                  className="h-32 w-32 rounded-full border-4 border-white/20 object-cover"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/20 bg-stride-card font-heading text-4xl font-bold text-white/60">
                  {member.full_name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="text-center">
                <p className="font-heading text-2xl font-bold text-white">{member.full_name}</p>
                <p className="mt-1 text-sm text-white/50">STRIDE ONE</p>
              </div>

              <dl className="w-full space-y-2 border-t border-white/10 pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-white/50">Miembro desde</dt>
                  <dd className="font-medium text-white">{formatDateCL(member.joined_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-white/50">Vigente hasta</dt>
                  <dd className={`font-medium ${valid ? "text-white" : "text-red-400"}`}>
                    {formatDateCL(member.valid_until)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-sm text-white/60">
              <p>
                Este código no corresponde a ningún miembro de STRIDE. Verifica que hayas escaneado
                el QR completo.
              </p>
            </div>
          )}
        </div>

        {scan?.id && <ScanGeoReporter scanId={scan.id} />}

        <div className="mt-6 space-y-3 text-center">
          <p className="flex items-center justify-center gap-1.5 text-xs text-white/40">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verificación oficial de stridechile.cl · {new Date().toLocaleString("es-CL", {
              timeZone: "America/Santiago",
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
          {/* Aviso de transparencia: Ley 19.628 sobre datos personales. */}
          <p className="flex items-start justify-center gap-1.5 text-[11px] leading-relaxed text-white/30">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              Registramos la fecha y el lugar de este canje para medir el uso de los convenios. Si
              no autorizas la ubicación, la validación funciona igual.
            </span>
          </p>
        </div>
      </div>
    </main>
  );
}
