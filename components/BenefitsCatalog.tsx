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
        <div className="mb-8 flex flex-wrap gap-2">
          {["todos", ...categories].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActive(cat)}
              aria-pressed={active === cat}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                active === cat
                  ? "bg-stride-accent text-white"
                  : "border border-white/10 text-white/60 hover:border-white/25 hover:text-white"
              }`}
            >
              {cat === "todos" ? "Todos" : labelFor(cat)}
            </button>
          ))}
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
                <p className="mt-0.5 text-xs uppercase tracking-wide text-white/35">
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
