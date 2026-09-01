"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { deleteLesson, moveLesson, saveLesson } from "@/app/miembros/community-actions";
import type { AccordionLesson } from "./LessonAccordion";

interface LessonDraft {
  id?: string;
  title: string;
  duration_label: string;
  video_url: string;
  content_md: string;
}

/**
 * Editor del classroom para el staff, dentro del propio curso:
 * crear, editar, reordenar y eliminar lecciones sin salir de /miembros.
 */
export function LessonAdminPanel({ courseId, lessons }: { courseId: string; lessons: AccordionLesson[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openNew = () =>
    setDraft({ title: "", duration_label: "lectura", video_url: "", content_md: "" });
  const openEdit = (lesson: AccordionLesson) =>
    setDraft({
      id: lesson.id,
      title: lesson.title,
      duration_label: lesson.duration_label ?? "",
      video_url: lesson.video_url ?? "",
      content_md: lesson.content_md ?? "",
    });

  const submit = () => {
    if (!draft) return;
    startTransition(async () => {
      const result = await saveLesson({ courseId, ...draft });
      if (!result.ok) return setError(result.error ?? "No pudimos guardar.");
      setDraft(null);
      setError(null);
      router.refresh();
    });
  };

  const remove = (lessonId: string) => {
    if (!window.confirm("¿Eliminar esta lección? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      await deleteLesson(lessonId);
      router.refresh();
    });
  };

  const move = (lessonId: string, direction: "up" | "down") => {
    startTransition(async () => {
      await moveLesson(lessonId, direction);
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-stride-accent/35 bg-[var(--scard)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-heading text-sm font-bold">
          <span className="rounded-full bg-stride-accent px-2 py-0.5 text-[10px] font-bold uppercase text-white">Admin</span>
          Editar lecciones
        </h2>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-full bg-stride-accent px-3.5 py-1.5 font-heading text-xs font-bold text-white transition hover:bg-stride-accentDark"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar lección
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        {lessons.map((lesson, index) => (
          <div key={lesson.id} className="flex items-center gap-2 rounded-xl bg-[var(--scard2)] px-3 py-2">
            <span className="w-5 text-center font-heading text-xs font-bold text-[var(--sdim)]">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{lesson.title}</span>
            <button type="button" aria-label="Subir" disabled={pending || index === 0} onClick={() => move(lesson.id, "up")} className="p-1 text-[var(--sdim)] transition hover:text-[var(--stext)] disabled:opacity-30">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Bajar" disabled={pending || index === lessons.length - 1} onClick={() => move(lesson.id, "down")} className="p-1 text-[var(--sdim)] transition hover:text-[var(--stext)] disabled:opacity-30">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Editar" onClick={() => openEdit(lesson)} className="p-1 text-stride-accent transition hover:opacity-70">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Eliminar" disabled={pending} onClick={() => remove(lesson.id)} className="p-1 text-red-400 transition hover:opacity-70">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {lessons.length === 0 && <p className="py-2 text-sm text-[var(--smut)]">Sin lecciones aún — agrega la primera.</p>}
      </div>

      {/* Modal de edición */}
      {draft && (
        <div className="fixed inset-0 z-[92] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && setDraft(null)}>
          <div className="m-rowin max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-bold">{draft.id ? "Editar lección" : "Nueva lección"}</h3>
              <button type="button" aria-label="Cerrar" onClick={() => setDraft(null)} className="text-[var(--sdim)] hover:text-[var(--stext)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 block text-xs font-semibold text-[var(--smut)]">
              Título
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[var(--sline2)] bg-[var(--scard2)] px-3.5 py-2.5 text-sm outline-none focus:border-stride-cyan"
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-[var(--smut)]">
                Etiqueta (ej: video · 3 min)
                <input
                  value={draft.duration_label}
                  onChange={(e) => setDraft({ ...draft, duration_label: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[var(--sline2)] bg-[var(--scard2)] px-3.5 py-2.5 text-sm outline-none focus:border-stride-cyan"
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--smut)]">
                Video de YouTube (opcional)
                <input
                  value={draft.video_url}
                  onChange={(e) => setDraft({ ...draft, video_url: e.target.value })}
                  placeholder="youtu.be/…"
                  className="mt-1 w-full rounded-xl border border-[var(--sline2)] bg-[var(--scard2)] px-3.5 py-2.5 text-sm outline-none focus:border-stride-cyan"
                />
              </label>
            </div>
            <label className="mt-3 block text-xs font-semibold text-[var(--smut)]">
              Contenido — las URLs y las menciones a el Blog / Retos / Calendario / Perfil se vuelven links solas
              <textarea
                value={draft.content_md}
                onChange={(e) => setDraft({ ...draft, content_md: e.target.value })}
                className="mt-1 min-h-48 w-full resize-y rounded-xl border border-[var(--sline2)] bg-[var(--scard2)] p-3.5 text-sm leading-relaxed outline-none focus:border-stride-cyan"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={submit} disabled={pending} className="btn-primary flex-1 px-4 py-2.5 text-sm disabled:opacity-60">
                {pending ? "Guardando…" : "Guardar lección"}
              </button>
              <button type="button" onClick={() => setDraft(null)} className="rounded-full border border-[var(--sline2)] px-4 py-2 text-sm text-[var(--smut)] hover:bg-[var(--shover)]">
                Cancelar
              </button>
            </div>
            {error && <p className="mt-2 text-xs font-semibold text-red-400">{error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
