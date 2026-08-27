import { notFound } from "next/navigation";
import Image from "next/image";
import { Sparkles, Info } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { isMembershipValid, formatDateCL } from "@/lib/membership";
import { MemberQR } from "@/components/MemberQR";
import type { Member, Benefit } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mi tarjeta STRIDE ONE",
  // El link es un secreto: no debe terminar indexado en Google.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Tarjeta virtual del miembro. Se llega por link privado (card_token) que el
 * equipo le envía por WhatsApp al activarlo; el miembro la guarda en la
 * pantalla de inicio de su celular y la muestra en el local.
 */
export default async function TarjetaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("members")
    .select("member_code, full_name, photo_url, status, valid_until, joined_at")
    .eq("card_token", token)
    .maybeSingle();

  const member = data as Pick<
    Member,
    "member_code" | "full_name" | "photo_url" | "status" | "valid_until" | "joined_at"
  > | null;

  if (!member) notFound();

  const valid = isMembershipValid(member);

  const { data: benefitsData } = await supabase
    .from("benefits")
    .select("id, business_name, category, discount_label")
    .eq("active", true)
    .order("sort_order");

  const benefits = (benefitsData ?? []) as Pick<
    Benefit,
    "id" | "business_name" | "category" | "discount_label"
  >[];

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stridechile.cl";
  const validateUrl = `${siteUrl}/validar/${member.member_code}`;

  return (
    <main className="min-h-dvh bg-stride-bg px-5 py-8">
      <div className="mx-auto w-full max-w-sm space-y-6">
        {/* Tarjeta */}
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-stride-accent via-stride-accentDark to-stride-bg p-[1.5px]">
          <div className="rounded-3xl bg-stride-card">
            <div className="flex items-center justify-between px-6 pt-6">
              <div>
                <p className="font-heading text-xl font-extrabold tracking-tight text-white">
                  STRIDE ONE
                </p>
                <p className="text-[11px] uppercase tracking-widest text-white/40">
                  Membresía
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  valid
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {valid ? "Activa" : "Inactiva"}
              </span>
            </div>

            <div className="flex items-center gap-4 px-6 py-5">
              {member.photo_url ? (
                <Image
                  src={member.photo_url}
                  alt={member.full_name}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full border-2 border-white/15 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/15 bg-white/5 font-heading text-2xl font-bold text-white/60">
                  {member.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-heading text-lg font-bold text-white">
                  {member.full_name}
                </p>
                <p className="text-xs text-white/45">
                  Miembro desde {formatDateCL(member.joined_at)}
                </p>
                <p className="text-xs text-white/45">
                  Vigente hasta {formatDateCL(member.valid_until)}
                </p>
              </div>
            </div>

            {/* QR: contiene la URL de validación, se escanea con la cámara del local */}
            <div className="flex flex-col items-center gap-3 border-t border-white/5 px-6 py-6">
              <MemberQR value={validateUrl} disabled={!valid} />
              <p className="font-mono text-sm tracking-[0.2em] text-white/50">
                {member.member_code}
              </p>
            </div>
          </div>
        </div>

        {valid ? (
          <p className="flex items-start gap-2 rounded-2xl bg-white/5 p-4 text-xs leading-relaxed text-white/60">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-stride-accent" />
            <span>
              Muestra este código en los comercios con convenio. Escanean con la cámara de su
              celular y ven al instante que tu membresía está vigente.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-2xl bg-red-500/10 p-4 text-xs leading-relaxed text-red-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Tu membresía no está vigente, así que el código no aplica beneficios. Escríbenos por
              WhatsApp para reactivarla.
            </span>
          </p>
        )}

        {benefits.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wide text-white/70">
              <Sparkles className="h-4 w-4 text-stride-amber" />
              Tus beneficios
            </h2>
            <ul className="space-y-2">
              {benefits.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-stride-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{b.business_name}</p>
                    <p className="text-xs capitalize text-white/40">{b.category}</p>
                  </div>
                  {b.discount_label && (
                    <span className="shrink-0 rounded-full bg-stride-accent/15 px-3 py-1 text-xs font-bold text-stride-accent">
                      {b.discount_label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="pb-4 text-center text-[11px] text-white/25">
          Guarda esta página en la pantalla de inicio de tu celular.
          <br />
          Este link es personal, no lo compartas.
        </p>
      </div>
    </main>
  );
}
