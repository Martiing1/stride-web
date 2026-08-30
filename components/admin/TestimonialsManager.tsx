"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Check, Eye, EyeOff, Loader2, MessageSquareQuote, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import {
  createTestimonial,
  deleteTestimonial,
  setTestimonialPublished,
  updateTestimonial,
} from "@/app/admin/testimonios/actions";
import type { Testimonial } from "@/lib/types";

/** Los testimonios de la landing, editables sin pasar por Supabase. */
export function TestimonialsManager({
  testimonials,
  canDelete,
}: {
  testimonials: Testimonial[];
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      {creating ? (
        <TestimonialForm title="Nuevo testimonio" action={createTestimonial} onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Agregar testimonio
        </button>
      )}

      {testimonials.length > 0 ? (
        <div className="space-y-4">
          {testimonials.map((testimonial) =>
            editing === testimonial.id ? (
              <TestimonialForm
                key={testimonial.id}
                title={`Editar el testimonio de ${testimonial.author_name}`}
                testimonial={testimonial}
                action={updateTestimonial}
                onDone={() => setEditing(null)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <TestimonialCard
                key={testimonial.id}
                testimonial={testimonial}
                canDelete={canDelete}
                onEdit={() => setEditing(testimonial.id)}
              />
            )
          )}
        </div>
      ) : (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <MessageSquareQuote className="h-10 w-10 text-white/25" />
          <p className="text-white/50">Todavía no hay testimonios. La landing no muestra la sección hasta que publiques uno.</p>
        </div>
      )}
    </div>
  );
}

function TestimonialCard({
  testimonial,
  canDelete,
  onEdit,
}: {
  testimonial: Testimonial;
  canDelete: boolean;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function run(action: (form: FormData) => Promise<unknown>, entries: Record<string, string>) {
    const form = new FormData();
    form.set("id", testimonial.id);
    Object.entries(entries).forEach(([k, v]) => form.set(k, v));
    startTransition(async () => {
      await action(form);
    });
  }

  return (
    <article className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-heading text-lg font-bold text-white">{testimonial.author_name}</p>
          {testimonial.author_role && <p className="text-xs text-white/35">{testimonial.author_role}</p>}
        </div>
        <div className="flex items-center gap-2">
          {testimonial.rating ? (
            <span className="inline-flex items-center gap-1 text-xs text-stride-amber">
              <Star className="h-3.5 w-3.5 fill-current" /> {testimonial.rating}
            </span>
          ) : null}
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${testimonial.published ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-white/40"}`}>
            {testimonial.published ? "Publicado" : "Borrador"}
          </span>
        </div>
      </div>

      <blockquote className="mt-3 border-l-2 border-stride-accent/40 pl-4 text-sm leading-relaxed text-white/60">
        {testimonial.quote}
      </blockquote>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white">
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(setTestimonialPublished, { published: testimonial.published ? "false" : "true" })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : testimonial.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {testimonial.published ? "Quitar de la web" : "Publicar"}
        </button>
        {canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`¿Borrar el testimonio de ${testimonial.author_name}?`)) run(deleteTestimonial, {});
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/40 hover:border-red-400/40 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" /> Borrar
          </button>
        )}
      </div>
    </article>
  );
}

function TestimonialForm({
  title,
  testimonial,
  action,
  onDone,
  onCancel,
}: {
  title: string;
  testimonial?: Testimonial;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (testimonial) form.set("id", testimonial.id);
    setError(null);
    startTransition(async () => {
      const result = await action(form);
      if (result.ok) onDone();
      else setError(result.error ?? "No se pudo guardar.");
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="font-heading text-lg font-bold text-white">{title}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="author_name" className="label">Quién lo dice</label>
          <input id="author_name" name="author_name" required defaultValue={testimonial?.author_name} className="input" placeholder="Camila R." />
        </div>
        <div>
          <label htmlFor="author_role" className="label">Cómo presentarlo</label>
          <input id="author_role" name="author_role" defaultValue={testimonial?.author_role ?? ""} className="input" placeholder="Miembro desde 2025" />
        </div>
      </div>

      <div>
        <label htmlFor="quote" className="label">Testimonio</label>
        <textarea id="quote" name="quote" required rows={4} defaultValue={testimonial?.quote} className="input resize-y" placeholder="Llegué sin saber correr y me quedé por la gente." />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="rating" className="label">Estrellas</label>
          <select id="rating" name="rating" defaultValue={testimonial?.rating ?? ""} className="input">
            <option value="">Sin puntaje</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sort_order" className="label">Orden</label>
          <input id="sort_order" name="sort_order" type="number" min={0} defaultValue={testimonial?.sort_order ?? 0} className="input" />
        </div>
        <div>
          <label htmlFor="photo_url" className="label">Foto (URL)</label>
          <input id="photo_url" name="photo_url" type="url" defaultValue={testimonial?.photo_url ?? ""} className="input" placeholder="https://…" />
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Guardar</>}
        </button>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-white/60 hover:text-white">
          <X className="h-4 w-4" /> Cancelar
        </button>
      </div>
    </form>
  );
}
