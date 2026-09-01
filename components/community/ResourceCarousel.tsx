"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import clsx from "clsx";
import type { CourseView } from "@/lib/community";

export interface ExternalResource {
  title: string;
  subtitle: string;
  emoji: string;
  href: string;
  badge: string;
}

/**
 * Recursos como carrusel horizontal: las tarjetas con portada (estilo Skool)
 * en una fila navegable con flechas. Admite recursos externos (Drive, Spotify).
 */
export function ResourceCarousel({
  courses,
  externals = [],
}: {
  courses: CourseView[];
  externals?: ExternalResource[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = () => {
    const track = trackRef.current;
    if (!track) return;
    setAtStart(track.scrollLeft <= 8);
    setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 8);
  };

  const scroll = (direction: 1 | -1) => {
    trackRef.current?.scrollBy({ left: direction * 480, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">Recursos</h2>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Anteriores"
            onClick={() => scroll(-1)}
            disabled={atStart}
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-full border transition",
              atStart
                ? "cursor-default border-[var(--sline)] text-[var(--sdim)] opacity-40"
                : "border-[var(--sline2)] text-[var(--smut)] hover:bg-[var(--shover)] hover:text-[var(--stext)]"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Siguientes"
            onClick={() => scroll(1)}
            disabled={atEnd}
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-full border transition",
              atEnd
                ? "cursor-default border-[var(--sline)] text-[var(--sdim)] opacity-40"
                : "border-[var(--sline2)] text-[var(--smut)] hover:bg-[var(--shover)] hover:text-[var(--stext)]"
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={updateEdges}
        className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-1 pb-1"
      >
        {courses.map((course) => {
          const pct = course.lesson_count > 0 ? Math.round((course.done_count / course.lesson_count) * 100) : null;
          return (
            <Link
              key={course.id}
              href={`/miembros/classroom/${course.id}`}
              className="group w-[172px] flex-none snap-start overflow-hidden rounded-2xl border border-[var(--sline)] bg-[var(--scard)] transition hover:border-[var(--sline2)] sm:w-[196px]"
            >
              <div className="relative flex h-[92px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#101018] to-[#1a1030]">
                {course.category === "plan" ? (
                  <span className="wordmark font-heading text-3xl font-extrabold tracking-tight">
                    {course.title.replace("Plan ", "")}
                  </span>
                ) : (
                  <span className="text-3xl transition-transform duration-300 group-hover:scale-110">{course.emoji}</span>
                )}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-stride-cyan/40 via-stride-indigo/40 to-stride-accent/40" />
              </div>
              <div className="p-3.5">
                <p className="truncate font-heading text-[13px] font-bold">{course.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--sdim)]">{course.subtitle}</p>
                {pct !== null ? (
                  <>
                    <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[var(--shover)]">
                      <div className="gradient-surface h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-[10px] text-[var(--sdim)]">{pct}%</p>
                  </>
                ) : (
                  <p className="mt-2.5 text-[10px] text-[var(--sdim)]">próximamente</p>
                )}
              </div>
            </Link>
          );
        })}

        {externals.map((resource) => (
          <a
            key={resource.href}
            href={resource.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group w-[172px] flex-none snap-start overflow-hidden rounded-2xl border border-[var(--sline)] bg-[var(--scard)] transition hover:border-[var(--sline2)] sm:w-[196px]"
          >
            <div className="relative flex h-[92px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#101018] to-[#1a1030]">
              <span className="text-3xl transition-transform duration-300 group-hover:scale-110">{resource.emoji}</span>
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-stride-cyan/40 via-stride-indigo/40 to-stride-accent/40" />
            </div>
            <div className="p-3.5">
              <p className="truncate font-heading text-[13px] font-bold">{resource.title}</p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--sdim)]">{resource.subtitle}</p>
              <p className="mt-2.5 flex items-center gap-1 text-[10px] font-semibold text-stride-accent">
                <ExternalLink className="h-3 w-3" /> {resource.badge}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
