import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { EventCard } from "@/components/EventCard";
import { EventAgenda } from "@/components/EventAgenda";
import { LeadForm } from "@/components/LeadForm";
import { todayInChile } from "@/lib/membership";
import { isDev, DEV_EVENTS } from "@/lib/dev-placeholders";
import { SITE } from "@/lib/site";
import type { StrideEvent } from "@/lib/types";

export const revalidate = 300;

export const metadata = {
  title: "Social Runs y eventos",
  description:
    "Calendario de Social Runs de STRIDE en Concepción: punto de encuentro, distancia e inscripción.",
};

export default async function EventosPage() {
  const supabase = await createClient();
  const today = todayInChile();

  const [dbUpcoming, past] = await Promise.all([
    safeQuery(
      () =>
        supabase
          .from("events")
          .select("*")
          .eq("is_public", true)
          .eq("status", "confirmado")
          .gte("event_date", today)
          .order("event_date"),
      [] as StrideEvent[]
    ),
    safeQuery(
      () =>
        supabase
          .from("events")
          .select("*")
          .eq("is_public", true)
          .eq("status", "completado")
          .order("event_date", { ascending: false })
          .limit(6),
      [] as StrideEvent[]
    ),
  ]);

  // Muestras solo en desarrollo, mientras Supabase no esté conectado.
  const upcoming = dbUpcoming.length > 0 || !isDev ? dbUpcoming : DEV_EVENTS;

  return (
    <>
      <SiteNav />

      <main>
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <h1 className="font-heading text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Social Runs
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/65">
              Gratis, abiertos y sin nivel mínimo. Reservas tu cupo, llegas con tu ticket y
              corremos por {SITE.city}. Después vienen los juegos, los sorteos y los regalos.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="mb-8 font-heading text-2xl font-bold text-white">Próximos</h2>

          {/* Misma agenda que la landing, para que la experiencia no cambie. */}
          {upcoming.length > 0 ? (
            <EventAgenda events={upcoming} />
          ) : (
            <div className="card flex flex-col items-center gap-4 py-14 text-center">
              <CalendarDays className="h-10 w-10 text-white/25" />
              <div>
                <p className="font-heading text-xl font-bold text-white">
                  Estamos cerrando la próxima fecha
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
                  Confirmamos el Social Run cada semana según la ruta y el equipo disponible. Déjanos
                  tus datos y te avisamos apenas esté.
                </p>
              </div>
              <Link href="/#sumate" className="btn-primary">
                Avísenme del próximo
              </Link>
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section className="border-t border-white/5 bg-stride-card/30">
            <div className="mx-auto max-w-6xl px-5 py-16">
              <h2 className="mb-8 font-heading text-2xl font-bold text-white">Ya corrimos</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {past.map((event) => (
                  <EventCard key={event.id} event={event} past />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-2xl px-5 py-20">
          <div className="mb-6 text-center">
            <h2 className="font-heading text-3xl font-extrabold text-white">
              Que no se te pase ninguno
            </h2>
            <p className="mt-2 text-white/55">
              Te escribimos por WhatsApp cada vez que confirmamos una fecha.
            </p>
          </div>
          <LeadForm source="eventos" />
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
