import Link from "next/link";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import clsx from "clsx";
import { getCurrentMember } from "@/lib/member-auth";
import { getCourses, type CourseView } from "@/lib/community";
import { ResourceCarousel } from "@/components/community/ResourceCarousel";

export const dynamic = "force-dynamic";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function monthLabel(date: string | null): string {
  if (!date) return "";
  const [, month] = date.split("-").map(Number);
  return MONTHS[month - 1] ?? "";
}

/**
 * Classroom al estilo Skool: la etapa del mes al frente y una grilla de
 * Recursos (planes + biblioteca juntos) con portada y barra de progreso.
 */
export default async function ClassroomPage() {
  const member = await getCurrentMember();
  const courses = await getCourses(member?.id ?? "00000000-0000-0000-0000-000000000000");

  const etapas = courses.filter((c) => c.category === "etapa");
  const recursos = courses.filter((c) => c.category !== "etapa");
  const etapaActual = [...etapas].reverse().find((c) => !c.locked);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl font-bold">Classroom</h1>

      {courses.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--sline2)] p-10 text-center">
          <p className="font-heading font-bold">El contenido viene en camino</p>
          <p className="mt-1 text-sm text-[var(--smut)]">El staff está cargando los planes y la etapa del mes.</p>
        </div>
      )}

      {/* Etapa del mes */}
      {etapaActual && (
        <div className="gradient-border">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-[var(--scard)] p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stride-accent">
              Etapa del mes · {monthLabel(etapaActual.opens_month)}
            </p>
            <h2 className="mt-1.5 font-heading text-2xl font-bold">
              {etapaActual.title.replace(/^Etapa \d+ · /, "")}
            </h2>
            {etapaActual.subtitle && <p className="mt-1 text-sm text-[var(--smut)]">{etapaActual.subtitle}</p>}
            <Progress course={etapaActual} />
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link href={`/miembros/classroom/${etapaActual.id}`} className="btn-primary px-5 py-2.5 text-sm">
                Entrar a la etapa
              </Link>
              <Link
                href="/miembros/retos"
                className="rounded-full border border-[var(--sline2)] px-5 py-2.5 font-heading text-sm font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]"
              >
                Reto del mes →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recursos: tarjetas con portada en carrusel horizontal con flechas.
          Los recursos del mes (guías y playlist reales) viven aquí también. */}
      {(recursos.length > 0 || true) && (
        <section>
          <ResourceCarousel
            courses={recursos}
            externals={[
              {
                title: "Cómo correr sin lesionarte",
                subtitle: "Guía del mes · errores del principiante",
                emoji: "🩹",
                href: "https://drive.google.com/file/d/1wEvFUuqxjHq1xuWhIEkY_vogTMWnvrKs/view",
                badge: "abre en Drive",
              },
              {
                title: "Alimentación para runners",
                subtitle: "Guía del mes · qué comer y cuándo",
                emoji: "🥗",
                href: "https://drive.google.com/file/d/1RgXo0R43CcD_Bi42Rj8uNwHxbJNEtzPP/view",
                badge: "abre en Drive",
              },
              {
                title: "Playlist STRIDE",
                subtitle: "La música del equipo para esta etapa",
                emoji: "🎵",
                href: "https://open.spotify.com/playlist/6jCP9nnAM7y5DQv4Rq2OiA",
                badge: "abre en Spotify",
              },
            ]}
          />
        </section>
      )}

      {/* Etapas del programa */}
      {etapas.length > 0 && (
        <section>
          <h2 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">
            Etapas del programa
          </h2>
          <div className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] px-4">
            {etapas.map((etapa) => {
              const isCurrent = etapa.id === etapaActual?.id;
              const isPast = !etapa.locked && !isCurrent;
              const badge = (
                <span
                  className={clsx(
                    "flex h-8 w-8 flex-none items-center justify-center rounded-full font-heading text-xs font-bold",
                    isCurrent && "gradient-surface text-white",
                    isPast && "bg-emerald-500/12 text-emerald-500",
                    etapa.locked && "bg-[var(--shover)] text-[var(--sdim)]"
                  )}
                >
                  {etapa.locked ? <Lock className="h-3.5 w-3.5" /> : isPast ? "✓" : etapa.emoji}
                </span>
              );

              // Bloqueada: se puede apretar igual → despliega el detalle.
              if (etapa.locked) {
                return (
                  <details key={etapa.id} className="group border-b border-[var(--sline)] last:border-b-0">
                    <summary className="flex cursor-pointer list-none items-center gap-3 py-3 opacity-55 transition hover:opacity-80 [&::-webkit-details-marker]:hidden">
                      {badge}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-heading text-sm font-semibold text-[var(--smut)]">{etapa.title}</p>
                        <p className="text-[11px] text-[var(--sdim)]">se abre en {monthLabel(etapa.opens_month)}</p>
                      </div>
                      <ChevronDown className="h-4 w-4 flex-none text-[var(--sdim)] transition group-open:rotate-180" />
                    </summary>
                    <div className="pb-3 pl-11 pr-2 text-sm text-[var(--smut)]">
                      {etapa.subtitle ?? "El contenido de esta etapa se libera cuando llegue su mes."}
                      <span className="mt-1 block text-xs text-[var(--sdim)]">
                        Incluye lecciones, su reto del mes y sesión en vivo.
                      </span>
                    </div>
                  </details>
                );
              }

              return (
                <Link
                  key={etapa.id}
                  href={`/miembros/classroom/${etapa.id}`}
                  className="group flex items-center gap-3 border-b border-[var(--sline)] py-3 transition last:border-b-0 hover:bg-[var(--shover)]"
                >
                  {badge}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-sm font-semibold">{etapa.title}</p>
                    <p className="text-[11px] text-[var(--sdim)]">
                      {isCurrent ? "en curso · reto activo" : `completada · ${monthLabel(etapa.opens_month)}`}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="rounded-full border border-stride-cyan/40 bg-stride-cyan/10 px-2.5 py-1 text-[10px] font-bold text-stride-cyan">
                      ahora
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 flex-none text-[var(--sdim)] transition group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Progress({ course }: { course: CourseView }) {
  if (course.lesson_count === 0) return null;
  const pct = Math.round((course.done_count / course.lesson_count) * 100);
  return (
    <div className="mt-4">
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--shover)]">
        <div className="gradient-surface h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--sdim)]">
        {course.done_count} de {course.lesson_count} lecciones · {pct}%
      </p>
    </div>
  );
}
