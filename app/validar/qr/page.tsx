import Image from "next/image";
import { headers } from "next/headers";
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { ScanGeoReporter } from "@/components/ScanGeoReporter";
import { getSignedMemberPhoto } from "@/lib/member-auth";
import { formatDateCL, isMembershipValid } from "@/lib/membership";
import { verifyRotatingQrToken } from "@/lib/rotating-qr";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Validar membresía", robots: { index: false, follow: false, nocache: true } };

export default async function RotatingValidationPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const payload = t ? verifyRotatingQrToken(t) : null;
  const service = createServiceClient();

  const { data } = payload
    ? await service.from("members").select("id, member_code, full_name, photo_url, photo_path, status, valid_until, joined_at").eq("member_code", payload.c).maybeSingle()
    : { data: null };
  const member = data as Pick<Member, "id" | "member_code" | "full_name" | "photo_url" | "photo_path" | "status" | "valid_until" | "joined_at"> | null;
  const valid = Boolean(payload && member && isMembershipValid(member));
  const photoUrl = member ? await getSignedMemberPhoto(member) : null;

  const userAgent = (await headers()).get("user-agent");
  // Se recupera el id para que ScanGeoReporter pueda adjuntarle la ubicación:
  // las métricas de uso por comercio son lo que sostiene la renegociación de
  // los convenios.
  const { data: scan } = payload
    ? await service
        .from("scans")
        .insert({
          member_id: member?.id ?? null,
          member_code: payload.c,
          was_valid: valid,
          geo_source: "no_disponible",
          user_agent: userAgent,
        })
        .select("id")
        .single()
    : { data: null };

  const title = valid ? "Membresía válida" : !payload ? "QR vencido" : member ? "Membresía no vigente" : "Código no válido";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stride-bg px-5 py-10">
      <div className="w-full max-w-md">
        <div className={`overflow-hidden rounded-3xl border-2 ${valid ? "border-emerald-500 bg-emerald-500/10" : "border-red-500 bg-red-500/10"}`}>
          <div className={`flex flex-col items-center gap-3 px-6 py-8 text-center ${valid ? "bg-emerald-500" : "bg-red-500"}`}>
            {valid ? <CheckCircle2 className="h-16 w-16 text-white" strokeWidth={2.5} /> : <XCircle className="h-16 w-16 text-white" strokeWidth={2.5} />}
            <h1 className="font-heading text-3xl font-extrabold uppercase leading-tight text-white">{title}</h1>
            <p className="text-sm font-medium text-white/90">{valid ? "Puedes aplicar el beneficio STRIDE" : !payload ? "Pide al miembro que abra nuevamente su carnet" : "No apliques el beneficio"}</p>
          </div>

          {member && payload ? (
            <div className="flex flex-col items-center gap-4 px-6 py-8">
              {photoUrl ? <Image src={photoUrl} alt={member.full_name} width={128} height={128} unoptimized className="h-32 w-32 rounded-full border-4 border-white/20 object-cover" /> : <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/20 bg-stride-card font-heading text-4xl font-bold text-white/60">{member.full_name.charAt(0).toUpperCase()}</div>}
              <div className="text-center"><p className="font-heading text-2xl font-bold text-white">{member.full_name}</p><p className="mt-1 text-sm text-white/50">STRIDE ONE</p></div>
              <dl className="w-full space-y-2 border-t border-white/10 pt-4 text-sm"><div className="flex justify-between"><dt className="text-white/50">Miembro desde</dt><dd className="font-medium text-white">{formatDateCL(member.joined_at)}</dd></div><div className="flex justify-between"><dt className="text-white/50">Vigente hasta</dt><dd className={valid ? "font-medium text-white" : "font-medium text-red-300"}>{formatDateCL(member.valid_until)}</dd></div></dl>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-sm leading-relaxed text-white/60">Este QR se renueva cada 5 minutos. No aceptes capturas vencidas.</div>
          )}
        </div>
        {scan?.id && <ScanGeoReporter scanId={scan.id} />}

        <div className="mt-5 space-y-2 text-center"><p className="flex items-center justify-center gap-2 text-xs text-white/40"><ShieldCheck className="h-3.5 w-3.5" /> Verificación oficial de stridechile.cl</p><p className="flex items-center justify-center gap-2 text-[11px] text-white/25"><Clock3 className="h-3 w-3" /> El resultado siempre consulta la vigencia actual</p></div>
      </div>
    </main>
  );
}
