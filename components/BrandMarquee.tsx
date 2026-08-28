const BRANDS = [
  "Dreams Café",
  "RideOne",
  "Starbucks",
  "Inmerso",
  "ASICS",
  "Chile Suplementos",
  "Pura Vida",
  "The Body Club",
  "Master Suplementos",
];

/** Franja continua de marcas documentadas como colaboradoras de STRIDE. */
export function BrandMarquee() {
  const loop = [...BRANDS, ...BRANDS];

  return (
    <section className="overflow-hidden border-y border-white/5 bg-stride-card/25 py-12">
      <div className="mx-auto max-w-6xl px-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stride-cyan">
          Marcas que han sido parte del camino
        </p>
      </div>

      <div
        className="relative mt-7 flex overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <ul className="animate-marquee flex shrink-0 gap-3 pr-3 motion-reduce:animate-none">
          {loop.map((brand, index) => (
            <li
              key={`${brand}-${index}`}
              aria-hidden={index >= BRANDS.length}
              className="flex h-20 w-[220px] shrink-0 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#111118] px-6"
            >
              <span className="gradient-surface h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_14px_rgba(99,102,241,0.7)]" />
              <span className="text-center font-heading text-base font-bold tracking-wide text-white/80">
                {brand}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
