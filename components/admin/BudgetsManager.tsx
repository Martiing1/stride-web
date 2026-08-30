"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { deleteBudget, saveBudget } from "@/app/admin/finanzas/presupuestos/actions";
import { formatCLP } from "@/lib/site";

export interface BudgetRow {
  id: string;
  year: number;
  month: number;
  category: string;
  kind: "ingreso" | "gasto";
  planned_clp: number;
  actual_clp: number;
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Presupuesto del mes por categoría, contra lo real del libro diario. */
export function BudgetsManager({ rows, year, month }: { rows: BudgetRow[]; year: number; month: number }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("year", String(year));
    form.set("month", String(month));
    setError(null);
    startTransition(async () => {
      const result = await saveBudget(form);
      if (result.ok) setCreating(false);
      else setError(result.error ?? "No se pudo guardar.");
    });
  }

  function remove(id: string, category: string) {
    if (!window.confirm(`¿Quitar la meta de «${category}»?`)) return;
    const form = new FormData();
    form.set("id", id);
    startTransition(async () => {
      await deleteBudget(form);
    });
  }

  const gastos = rows.filter((r) => r.kind === "gasto");
  const ingresos = rows.filter((r) => r.kind === "ingreso");

  return (
    <div className="space-y-6">
      {creating ? (
        <form onSubmit={submit} className="card flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="category" className="label">Categoría</label>
            <input id="category" name="category" required className="input" placeholder="premios, produccion…" />
          </div>
          <div>
            <label htmlFor="kind" className="label">Tipo</label>
            <select id="kind" name="kind" defaultValue="gasto" className="input w-auto">
              <option value="gasto" className="bg-stride-card">Gasto</option>
              <option value="ingreso" className="bg-stride-card">Ingreso</option>
            </select>
          </div>
          <div>
            <label htmlFor="planned_clp" className="label">Meta mensual (CLP)</label>
            <input id="planned_clp" name="planned_clp" type="number" min={0} required className="input" placeholder="150000" />
          </div>
          <div>
            <label htmlFor="span" className="label">Vigencia</label>
            <select id="span" name="span" defaultValue="1" className="input w-auto">
              <option value="1" className="bg-stride-card">Solo {MONTHS[month - 1]}</option>
              <option value="3" className="bg-stride-card">Trimestre ({MONTHS[month - 1]}–{MONTHS[(month + 1) % 12]})</option>
            </select>
          </div>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Guardar</>}
          </button>
          <button type="button" onClick={() => setCreating(false)} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-white/60">
            <X className="h-4 w-4" /> Cancelar
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Nueva meta de {MONTHS[month - 1]}
        </button>
      )}

      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      {[{ label: "Gastos", list: gastos, over: "gastado" }, { label: "Ingresos", list: ingresos, over: "logrado" }].map(({ label, list, over }) =>
        list.length === 0 ? null : (
          <section key={label} className="card space-y-4">
            <h2 className="font-heading text-lg font-bold text-white">{label}</h2>
            <ul className="space-y-3">
              {list.map((row) => {
                const pct = row.planned_clp ? Math.min(1.5, row.actual_clp / row.planned_clp) : 0;
                const overBudget = row.kind === "gasto" && row.actual_clp > row.planned_clp;
                return (
                  <li key={row.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="capitalize text-white/80">{row.category}</span>
                      <span className="flex items-center gap-2">
                        <span className={overBudget ? "font-semibold text-red-300" : "text-white/60"}>
                          {formatCLP(row.actual_clp)} de {formatCLP(row.planned_clp)} {over}
                        </span>
                        <button type="button" onClick={() => remove(row.id, row.category)} aria-label="Quitar meta" className="rounded p-1 text-white/25 hover:text-red-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, pct * 100)}%`,
                          background: overBudget ? "#e66767" : row.kind === "gasto" ? "#3987e5" : "#199e70",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )
      )}

      {rows.length === 0 && !creating && (
        <p className="card py-10 text-center text-sm text-white/40">
          Sin metas para {MONTHS[month - 1]}. Crea la primera: arriendo de equipos, premios, producción…
        </p>
      )}
    </div>
  );
}
