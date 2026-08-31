"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CornerDownRight, Loader2, Plus, Trash2 } from "lucide-react";
import { createCategory, deleteCategory } from "@/app/admin/finanzas/categorias/actions";

export interface CatRow {
  id: string;
  kind: "ingreso" | "costo" | "gasto";
  name: string;
  parent_id: string | null;
}

const KINDS: Array<{ value: CatRow["kind"]; label: string; hint: string }> = [
  { value: "ingreso", label: "Ingresos", hint: "Lo que entra: membresías, sponsors." },
  { value: "costo", label: "Costos", hint: "Lo que cuesta producir el servicio: premios, hidratación, kits." },
  { value: "gasto", label: "Gastos", hint: "Lo que cuesta operar: software, comisiones, marketing." },
];

/** Catálogo de categorías y subcategorías del módulo de finanzas. */
export function FinanceCategoriesManager({ rows }: { rows: CatRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    setError(null);
    startTransition(async () => {
      const result = await createCategory(new FormData(target));
      if (result.ok) target.reset();
      else setError(result.error ?? "No se pudo crear.");
    });
  }

  function remove(row: CatRow, childCount: number) {
    const warn = row.parent_id
      ? `¿Borrar la subcategoría «${row.name}»?`
      : `¿Borrar «${row.name}»${childCount ? ` y sus ${childCount} subcategorías` : ""}? Los movimientos ya registrados no se tocan.`;
    if (!window.confirm(warn)) return;
    const form = new FormData();
    form.set("id", row.id);
    startTransition(async () => {
      const result = await deleteCategory(form);
      if (!result.ok) setError(result.error ?? "No se pudo borrar.");
    });
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      {KINDS.map(({ value, label, hint }) => {
        const parents = rows.filter((r) => r.kind === value && !r.parent_id);
        return (
          <section key={value} className="card space-y-4">
            <div>
              <h2 className="font-heading text-lg font-bold text-white">{label}</h2>
              <p className="text-sm text-white/40">{hint}</p>
            </div>

            {parents.length > 0 && (
              <ul className="space-y-2">
                {parents.map((parent) => {
                  const children = rows.filter((r) => r.parent_id === parent.id);
                  return (
                    <li key={parent.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-white">{parent.name}</span>
                        <button type="button" onClick={() => remove(parent, children.length)} aria-label={`Borrar ${parent.name}`} className="rounded p-1.5 text-white/25 hover:text-red-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {children.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {children.map((child) => (
                            <li key={child.id} className="flex items-center justify-between gap-3 pl-4 text-sm text-white/60">
                              <span className="flex items-center gap-1.5"><CornerDownRight className="h-3 w-3 text-white/25" /> {child.name}</span>
                              <button type="button" onClick={() => remove(child, 0)} aria-label={`Borrar ${child.name}`} className="rounded p-1 text-white/20 hover:text-red-300">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {/* subcategoría nueva dentro de esta categoría */}
                      <form onSubmit={create} className="mt-2 flex items-center gap-2 pl-4">
                        <input type="hidden" name="kind" value={value} />
                        <input type="hidden" name="parent_id" value={parent.id} />
                        <input name="name" required className="input flex-1 px-2.5 py-1.5 text-xs" placeholder="Nueva subcategoría…" />
                        <button type="submit" disabled={pending} className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white" aria-label="Agregar subcategoría">
                          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}

            <form onSubmit={create} className="flex items-center gap-2 border-t border-white/5 pt-3">
              <input type="hidden" name="kind" value={value} />
              <input type="hidden" name="parent_id" value="" />
              <input name="name" required className="input flex-1 py-2 text-sm" placeholder={`Nueva categoría de ${label.toLowerCase()}…`} />
              <button type="submit" disabled={pending} className="btn-primary px-4 py-2 text-sm">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Agregar</>}
              </button>
            </form>
          </section>
        );
      })}
    </div>
  );
}
