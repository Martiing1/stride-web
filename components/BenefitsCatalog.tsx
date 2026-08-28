"use client";

import { useMemo, useState } from "react";
import { Instagram, MapPin } from "lucide-react";
import type { Benefit } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  kinesiologia: "Kinesiología",
  nutricion: "Nutrición",
  masoterapia: "Masoterapia",
  podologia: "Podología",
  cafeteria: "Cafeterías",
  suplementos: "Suplementos",
  tienda: "Tiendas",
};

function labelFor(category: string): string {
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

/** Catálogo filtrable de convenios. Los datos vienen del ERP, no están hardcodeados. */
export function BenefitsCatalog({ benefits }: { benefits: Benefit[] }) {
  const [active, setActive] = useState<string>("todos");

  const categories = useMemo(
    () => Array.from(new Set(benefits.map((b) => b.category))),
    [benefits]
  );

  const visible = useMemo(
    () => (active === "todos" ? benefits : benefits.filter((b) => b.category === active)),
    [benefits, active]
  );

  if (benefits.length === 0) {
    return (
      <p className="card text-center text-sm text-white/50">
        Estamos cerrando nuevos convenios. Muy pronto vas a ver acá todos los beneficios.
      </p>
    );
  }

  return (
    <div>
      {categories.length > 1 && (
        <div className="gradient-border mb-10">
          <div className="relative overflow-hidden rounded-[calc(1.5rem-1.5px)] bg-[#11111a] p-5 sm:p-6">
            <div
              aria-hidden
              className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-stride-accent/20 blur-3xl"
            />
            <p className="relative text-xs font-semibold uppercase tracking-[0.22em] text-stride-cyan">
              Explora por categoría
            </p>
            <div className="relative mt-4 flex flex-wrap gap-2.5">
              {["todos", ...categories].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActive(cat)}
                  aria-pressed={active === cat}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    active === cat
                      ? "border-transparent bg-gradient-to-r from-stride-cyan via-stride-indigo to-stride-accent text-white shadow-[0_0_22px_rgba(99,102,241,0.28)]"
                      : "border-white/10 bg-white/[0.035] text-white/60 hover:border-stride-indigo/60 hover:text-white"
                  }`}
                >
                  {cat === "todos" ? "Todos" : labelFor(cat)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((benefit) => (
          <article key={benefit.id} className="card flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-heading text-lg font-bold leading-tight text-white">
                  {benefit.business_name}
                </h3>
                <p className="mt-2 inline-flex rounded-full border border-stride-indigo/30 bg-stride-indigo/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-stride-cyan">
                  {labelFor(benefit.category)}
                </p>
              </div>
              {benefit.discount_label && (
                <span className="shrink-0 rounded-full bg-stride-amber/15 px-3 py-1 text-xs font-bold text-stride-amber">
                  {benefit.discount_label}
                </span>
              )}
            </div>

            <p className="mt-3 flex-1 text-sm leading-relaxed text-white/55">
              {benefit.description}
            </p>

            {(benefit.address || benefit.instagram) && (
              <div className="mt-4 space-y-1.5 border-t border-white/5 pt-4 text-xs text-white/45">
                {benefit.address && (
                  <p className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {benefit.address}
                  </p>
                )}
                {benefit.instagram && (
                  <a
                    href={`https://instagram.com/${benefit.instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 transition hover:text-white"
                  >
                    <Instagram className="h-3.5 w-3.5 shrink-0" />
                    {benefit.instagram}
                  </a>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
