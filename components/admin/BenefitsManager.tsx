"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Check, Eye, EyeOff, HeartHandshake, Loader2, Pencil, Plus, X } from "lucide-react";
import { createBenefit, setBenefitActive, updateBenefit } from "@/app/admin/convenios/actions";
import type { Benefit } from "@/lib/types";

/**
 * Alta y edición de convenios desde el ERP.
 *
 * Antes había que entrar a Supabase para tocar un descuento, aunque de esta
 * tabla salen la página /one y la lista de beneficios de cada carnet.
 */
export function BenefitsManager({ benefits }: { benefits: Benefit[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      {creating ? (
        <BenefitForm
          title="Nuevo convenio"
          action={createBenefit}
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Agregar convenio
        </button>
      )}

      {benefits.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {benefits.map((benefit) =>
            editing === benefit.id ? (
              <div key={benefit.id} className="sm:col-span-2">
                <BenefitForm
                  title={`Editar ${benefit.business_name}`}
                  benefit={benefit}
                  action={updateBenefit}
                  onDone={() => setEditing(null)}
                  onCancel={() => setEditing(null)}
                />
              </div>
            ) : (
              <BenefitCard key={benefit.id} benefit={benefit} onEdit={() => setEditing(benefit.id)} />
            )
          )}
        </section>
      ) : (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <HeartHandshake className="h-10 w-10 text-white/25" />
          <p className="text-white/50">Todavía no hay convenios cargados.</p>
        </div>
      )}
    </div>
  );
}

function BenefitCard({ benefit, onEdit }: { benefit: Benefit; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    const form = new FormData();
    form.set("id", benefit.id);
    form.set("active", benefit.active ? "false" : "true");
    startTransition(async () => {
      await setBenefitActive(form);
    });
  }

  return (
    <article className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-heading text-lg font-bold text-white">{benefit.business_name}</h2>
          <p className="text-xs capitalize text-white/35">{benefit.category}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {benefit.discount_label && (
            <span className="rounded-full bg-stride-amber/15 px-2.5 py-1 text-xs font-bold text-stride-amber">
              {benefit.discount_label}
            </span>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${benefit.active ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-white/40"}`}>
            {benefit.active ? "Activo" : "Inactivo"}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-white/55">{benefit.description}</p>

      {(benefit.address || benefit.instagram) && (
        <p className="mt-3 space-x-3 text-xs text-white/35">
          {benefit.address && <span>{benefit.address}</span>}
          {benefit.instagram && <span>@{benefit.instagram}</span>}
        </p>
      )}

      <div className="mt-4 flex gap-2 border-t border-white/5 pt-4">
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white">
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        <button type="button" onClick={toggle} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : benefit.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {benefit.active ? "Ocultar de la web" : "Publicar"}
        </button>
      </div>
    </article>
  );
}

function BenefitForm({
  title,
  benefit,
  action,
  onDone,
  onCancel,
}: {
  title: string;
  benefit?: Benefit;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (benefit) form.set("id", benefit.id);
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
          <label htmlFor="business_name" className="label">Comercio</label>
          <input id="business_name" name="business_name" required defaultValue={benefit?.business_name} className="input" placeholder="Dreams Café" />
        </div>
        <div>
          <label htmlFor="category" className="label">Categoría</label>
          <input id="category" name="category" required defaultValue={benefit?.category} className="input" placeholder="cafeteria" />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="label">Qué obtiene el miembro</label>
        <textarea id="description" name="description" required rows={3} defaultValue={benefit?.description} className="input resize-y" placeholder="20% de descuento en toda la carta, de lunes a viernes." />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="discount_label" className="label">Etiqueta</label>
          <input id="discount_label" name="discount_label" defaultValue={benefit?.discount_label ?? ""} className="input" placeholder="20% OFF" />
        </div>
        <div>
          <label htmlFor="instagram" className="label">Instagram</label>
          <input id="instagram" name="instagram" defaultValue={benefit?.instagram ?? ""} className="input" placeholder="dreamscafe" />
        </div>
        <div>
          <label htmlFor="sort_order" className="label">Orden</label>
          <input id="sort_order" name="sort_order" type="number" min={0} defaultValue={benefit?.sort_order ?? 0} className="input" />
        </div>
      </div>

      <div>
        <label htmlFor="address" className="label">Dirección</label>
        <input id="address" name="address" defaultValue={benefit?.address ?? ""} className="input" placeholder="Av. Siempre Viva 123, Concepción" />
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
