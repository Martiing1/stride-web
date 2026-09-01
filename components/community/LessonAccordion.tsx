"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, ListChecks, PlayCircle } from "lucide-react";
import clsx from "clsx";
import { LessonToggle } from "./LessonToggle";

export interface AccordionLesson {
  id: string;
  title: string;
  video_url: string | null;
  content_md: string | null;
  duration_label: string | null;
  done: boolean;
}

/**
 * Lecciones del curso como acordeón: cada semana/módulo se abre al tocarla
 * para ver su detalle (video + contenido). La primera pendiente parte abierta.
 */
export function LessonAccordion({ lessons }: { lessons: AccordionLesson[] }) {
  const firstOpen = lessons.find((lesson) => !lesson.done)?.id ?? lessons[0]?.id ?? null;
  const [open, setOpen] = useState<string | null>(firstOpen);

  return (
    <div className="space-y-3">
      {lessons.map((lesson, index) => {
        const isOpen = open === lesson.id;
        const Icon = lesson.video_url
          ? PlayCircle
          : lesson.duration_label?.includes("checklist")
            ? ListChecks
            : BookOpen;
        return (
          <article key={lesson.id} className="overflow-hidden rounded-2xl border border-[var(--sline)] bg-[var(--scard)]">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : lesson.id)}
              className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-[var(--shover)]"
            >
              <span
                className={clsx(
                  "flex h-8 w-8 flex-none items-center justify-center rounded-full font-heading text-xs font-bold",
                  lesson.done ? "bg-emerald-500/12 text-emerald-500" : "bg-[var(--shover)] text-[var(--smut)]"
                )}
              >
                {lesson.done ? "✓" : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-sm font-bold leading-snug">{lesson.title}</span>
                {lesson.duration_label && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-[var(--sdim)]">
                    <Icon className="h-3.5 w-3.5" /> {lesson.duration_label}
                  </span>
                )}
              </span>
              <ChevronDown
                className={clsx("h-4 w-4 flex-none text-[var(--sdim)] transition-transform", isOpen && "rotate-180")}
              />
            </button>

            {isOpen && (
              <div className="m-pagein border-t border-[var(--sline)]">
                {lesson.video_url && (
                  <div className="aspect-video w-full">
                    <iframe
                      src={lesson.video_url}
                      title={lesson.title}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                <div className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    {lesson.content_md && <RichLessonText text={lesson.content_md} />}
                  </div>
                  <div className="flex flex-none flex-col items-center gap-1.5 pt-1">
                    <LessonToggle lessonId={lesson.id} initial={lesson.done} />
                    <span className="text-[10px] text-[var(--sdim)]">vista</span>
                  </div>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

/** Rutas internas que se convierten en hipervínculos dentro del contenido. */
const INTERNAL_LINKS: Array<[RegExp, string]> = [
  [/\bel Blog\b/g, "/miembros"],
  [/\bBlog\b/g, "/miembros"],
  [/\bel Calendario\b/g, "/miembros/calendario"],
  [/\bCalendario\b/g, "/miembros/calendario"],
  [/\bRetos\b/g, "/miembros/retos"],
  [/\bPerfil\b/g, "/miembros/perfil"],
];

const URL_PATTERN = /((?:https?:\/\/)?(?:drive\.google\.com|open\.spotify\.com|www\.youtube\.com|youtu\.be)\/[^\s)]+)/g;

/**
 * Renderiza el contenido de una lección volviendo clickeables las URLs
 * (Drive, Spotify, YouTube) y las menciones a secciones de la app.
 */
export function RichLessonText({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (const rawLine of text.split("\n")) {
    if (nodes.length > 0) nodes.push("\n");

    // 1) URLs externas
    const parts = rawLine.split(URL_PATTERN);
    for (const part of parts) {
      if (URL_PATTERN.test(part)) {
        URL_PATTERN.lastIndex = 0;
        const href = part.startsWith("http") ? part : `https://${part}`;
        nodes.push(
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-stride-accent underline underline-offset-2 hover:opacity-80">
            {part.replace(/^https?:\/\//, "")}
          </a>
        );
        continue;
      }
      URL_PATTERN.lastIndex = 0;

      // 2) Menciones internas (una pasada, primera regla que calce por segmento)
      let remaining = part;
      let matched = true;
      while (matched && remaining.length > 0) {
        matched = false;
        let best: { index: number; length: number; href: string; label: string } | null = null;
        for (const [pattern, href] of INTERNAL_LINKS) {
          pattern.lastIndex = 0;
          const match = pattern.exec(remaining);
          if (match && (best === null || match.index < best.index)) {
            best = { index: match.index, length: match[0].length, href, label: match[0] };
          }
        }
        if (best) {
          matched = true;
          if (best.index > 0) nodes.push(remaining.slice(0, best.index));
          nodes.push(
            <Link key={key++} href={best.href} className="font-semibold text-stride-accent underline underline-offset-2 hover:opacity-80">
              {best.label}
            </Link>
          );
          remaining = remaining.slice(best.index + best.length);
        }
      }
      if (remaining) nodes.push(remaining);
    }
  }

  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--smut)]">{nodes}</p>;
}
