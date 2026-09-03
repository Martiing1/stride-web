import { createServiceClient } from "@/lib/supabase/server";
import { firmaBaja } from "@/lib/baja";

export const dynamic = "force-dynamic";
export const metadata = { title: "Baja de correos", robots: { index: false, follow: false } };

/**
 * Baja de las comunicaciones de STRIDE en un click.
 * El enlace del correo trae el correo y una firma: sin la firma nadie puede
 * dar de baja a otra persona. Darse de baja es lo que evita que la gente
 * marque los correos como spam, que es lo que arruina la reputación del
 * dominio con el que los socios reciben su acceso.
 */

export default async function BajaPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; s?: string }>;
}) {
  const { e, s } = await searchParams;
  const email = (e ?? "").trim().toLowerCase();
  const valida = Boolean(email && s && s === firmaBaja(email));

  if (valida) {
    const service = createServiceClient();
    await service
      .from("leads")
      .update({ marketing_consent: false, notes: "Se dio de baja de los correos." })
      .ilike("email", email);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center text-white">
      {valida ? (
        <>
          <p className="text-4xl">✅</p>
          <h1 className="mt-4 font-heading text-2xl font-extrabold">Listo, no te escribimos más</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
            Sacamos <b className="text-white/80">{email}</b> de nuestros correos. Igual te esperamos en los
            Social Runs: siguen siendo gratis y no necesitas nada para llegar.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-heading text-2xl font-extrabold">Ese enlace no es válido</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
            Usa el enlace tal como viene en el correo. Si no resulta, respóndenos el correo y te sacamos a mano.
          </p>
        </>
      )}
      <a href="https://stridechile.cl" className="mt-6 rounded-full border border-white/15 px-6 py-2.5 font-heading text-sm font-semibold text-white/70">
        Ir a stridechile.cl
      </a>
    </main>
  );
}
