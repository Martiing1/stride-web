import { HeartHandshake } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Benefit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConveniosPage() {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const supabase = await createClient();

  const { data } = await supabase.from("benefits").select("*").order("sort_order");
  const benefits = (data ?? []) as Benefit[];

  const activos = benefits.filter((b) => b.active).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Convenios</h1>
        <p className="mt-1 text-white/50">
          {benefits.length} en total · {activos} activos y visibles en /one
        </p>
      </header>

      {benefits.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <article key={benefit.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-heading text-lg font-bold text-white">
                    {benefit.business_name}
                  </h2>
                  <p className="text-xs capitalize text-white/35">{benefit.category}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {benefit.discount_label && (
                    <span className="rounded-full bg-stride-amber/15 px-2.5 py-1 text-xs font-bold text-stride-amber">
                      {benefit.discount_label}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      benefit.active
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-white/10 text-white/40"
                    }`}
                  >
                    {benefit.active ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/55">{benefit.description}</p>
            </article>
          ))}
        </section>
      ) : (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <HeartHandshake className="h-10 w-10 text-white/25" />
          <p className="font-heading text-lg font-bold text-white">Todavía no hay convenios</p>
          <p className="max-w-sm text-sm text-white/50">
            Cárgalos en Supabase y aparecen automáticamente en /one y en la tarjeta de cada miembro.
          </p>
        </div>
      )}
    </div>
  );
}
