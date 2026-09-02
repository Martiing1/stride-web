"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { updateRule } from "@/app/admin/reglas/actions";

/** Edición inline de una regla (solo socios): texto, área y quién la lee. */
export function RuleEditor({ rule }: {
  rule: { id: string; title: string; statement: string; area: string | null; visibility: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("id", rule.id);
    setError(null);
    startTransition(async () => {
      const res = await updateRule(form);
      if (!res.ok) { setError(res.error ?? "No se pudo guardar."); return; }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 hover:text-white">
        <Pencil className="h-3 w-3" /> Editar regla
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-stride-accent/30 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Editar regla</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-md p-1 text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div>
        <label className="label" htmlFor={`t-${rule.id}`}>Título</label>
        <input id={`t-${rule.id}`} name="title" defaultValue={rule.title} required className="input py-2 text-sm" />
      </div>
      <div>
        <label className="label" htmlFor={`s-${rule.id}`}>Texto de la regla</label>
        <textarea id={`s-${rule.id}`} name="statement" defaultValue={rule.statement} rows={4} required className="input resize-y text-sm" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`a-${rule.id}`}>Área</label>
          <input id={`a-${rule.id}`} name="area" defaultValue={rule.area ?? ""} className="input py-2 text-sm" />
        </div>
        <div>
          <label className="label" htmlFor={`v-${rule.id}`}>Quién la lee</label>
          <select id={`v-${rule.id}`} name="visibility" defaultValue={rule.visibility} className="input py-2 text-sm">
            <option value="equipo" className="bg-stride-card">Todo el equipo</option>
            <option value="socios" className="bg-stride-card">Solo socios</option>
            <option value="area" className="bg-stride-card">Solo el área</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`r-${rule.id}`}>Motivo del cambio</label>
          <input id={`r-${rule.id}`} name="reason" className="input py-2 text-sm" placeholder="Queda en la historia" />
        </div>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary px-5 py-2 text-sm">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Guardar</>}
      </button>
    </form>
  );
}
