"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X, Loader2, Trash2, Pencil, Sparkles } from "lucide-react";
import {
  generateMonth, toggleItem, addItem, editItem, deleteItem,
} from "@/app/admin/membresia/actions";
import type { MonthChecklistItem, TeamMember } from "@/lib/types";

const CATEGORY_TONES: Record<string, string> = {
  contenido: "bg-stride-cyan/15 text-stride-cyan",
  comunidad: "bg-stride-indigo/20 text-stride-indigo",
  retos: "bg-stride-amber/15 text-stride-amber",
  kits: "bg-emerald-500/15 text-emerald-400",
};

export function MonthChecklist({
  month,
  items,
  team,
  today,
}: {
  month: string;
  items: MonthChecklistItem[];
  team: TeamMember[];
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = items.filter((i) => i.done).length;
  const progress = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  function toggle(item: MonthChecklistItem) {
    const form = new FormData();
    form.set("id", item.id);
    form.set("done", String(!item.done));
    startTransition(async () => {
      const res = await toggleItem(form);
      if (!res.ok) setError(res.error ?? "No se pudo actualizar.");
      router.refresh();
    });
  }

  async function generate() {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("month", month);
    const res = await generateMonth(form);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "No se pudo generar.");
    router.refresh();
  }

  async function submitAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("month", month);
    const res = await addItem(data);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "No se pudo agregar."); return; }
    form.reset();
    setShowAdd(false);
    router.refresh();
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    data.set("id", id);
    const res = await editItem(data);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "No se pudo guardar."); return; }
    setEditing(null);
    router.refresh();
  }

  async function remove(id: string, title: string) {
    if (!confirm(`¿Eliminar "${title}" de este mes?`)) return;
    const form = new FormData();
    form.set("id", id);
    const res = await deleteItem(form);
    if (!res.ok) setError(res.error ?? "No se pudo eliminar.");
    router.refresh();
  }

  const nameOf = (id: string | null) => {
    if (!id) return null;
    const p = team.find((t) => t.id === id);
    return p ? (p.nickname ?? p.full_name) : null;
  };

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-4 py-14 text-center">
        <Sparkles className="h-10 w-10 text-white/25" />
        <div>
          <p className="font-heading text-xl font-bold text-white">Este mes está vacío</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
            Genera el checklist desde la plantilla y aparecen todos los ítems que hay que
            cumplir en la membresía.
          </p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="button" onClick={generate} disabled={busy} className="btn-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /> Generar checklist del mes</>}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progreso */}
      <div className="card">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/50">Avance del mes</p>
            <p className="mt-1 font-heading text-3xl font-extrabold text-white">
              {done}<span className="text-lg text-white/30">/{items.length}</span>
            </p>
          </div>
          <span className={`font-heading text-2xl font-bold ${progress === 100 ? "text-emerald-400" : "text-stride-cyan"}`}>
            {progress}%
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${progress === 100 ? "bg-emerald-500" : "gradient-surface"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {!showAdd && (
          <button type="button" onClick={() => setShowAdd(true)} className="btn-primary px-5 py-2 text-sm">
            <Plus className="h-4 w-4" /> Agregar ítem
          </button>
        )}
        <button type="button" onClick={generate} disabled={busy} className="btn-secondary px-5 py-2 text-sm">
          <Sparkles className="h-4 w-4" /> Traer nuevos de la plantilla
        </button>
      </div>

      {showAdd && (
        <form onSubmit={submitAdd} className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-white">Ítem extra de este mes</h2>
            <button type="button" onClick={() => setShowAdd(false)} aria-label="Cerrar"
              className="rounded-lg p-1.5 text-white/40 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="title">Qué hay que hacer</label>
              <input id="title" name="title" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="category">Categoría</label>
              <input id="category" name="category" className="input" placeholder="contenido, kits…" />
            </div>
            <div>
              <label className="label" htmlFor="assignee_id">Responsable</label>
              <select id="assignee_id" name="assignee_id" defaultValue="" className="input">
                <option value="" className="bg-stride-card">Sin asignar</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id} className="bg-stride-card">{t.nickname ?? t.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="due_date">Fecha límite</label>
              <input id="due_date" name="due_date" type="date" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">Nota</label>
              <input id="notes" name="notes" className="input" />
            </div>
          </div>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agregar"}
          </button>
        </form>
      )}

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

      <ul className="space-y-2">
        {items.map((item) => {
          const overdue = !item.done && item.due_date && item.due_date < today;
          const assignee = nameOf(item.assignee_id);

          if (editing === item.id) {
            return (
              <li key={item.id}>
                <form onSubmit={(e) => submitEdit(e, item.id)} className="card space-y-3">
                  <input name="title" defaultValue={item.title} required className="input" />
                  <input name="notes" defaultValue={item.notes ?? ""} className="input" placeholder="Nota" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select name="assignee_id" defaultValue={item.assignee_id ?? ""} className="input">
                      <option value="" className="bg-stride-card">Sin asignar</option>
                      {team.map((t) => (
                        <option key={t.id} value={t.id} className="bg-stride-card">{t.nickname ?? t.full_name}</option>
                      ))}
                    </select>
                    <input name="due_date" type="date" defaultValue={item.due_date ?? ""} className="input" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="btn-primary px-5 py-2 text-sm">Guardar</button>
                    <button type="button" onClick={() => setEditing(null)} className="btn-secondary px-5 py-2 text-sm">Cancelar</button>
                  </div>
                </form>
              </li>
            );
          }

          return (
            <li key={item.id} className={`card flex items-start gap-3 py-4 ${overdue ? "border-red-500/30" : ""}`}>
              <button
                type="button"
                onClick={() => toggle(item)}
                disabled={pending}
                aria-pressed={item.done}
                aria-label={item.done ? `Desmarcar ${item.title}` : `Marcar ${item.title}`}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                  item.done
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-white/25 hover:border-stride-cyan"
                }`}
              >
                {item.done && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
              </button>

              <div className="min-w-0 flex-1">
                <p className={`text-sm ${item.done ? "text-white/40 line-through" : "text-white"}`}>
                  {item.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
                  {item.category && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      CATEGORY_TONES[item.category] ?? "bg-white/10 text-white/50"
                    }`}>
                      {item.category}
                    </span>
                  )}
                  {assignee && <span>{assignee}</span>}
                  {item.due_date && (
                    <span className={overdue ? "text-red-400" : ""}>
                      {overdue ? "venció " : "vence "}{item.due_date.split("-").reverse().join("/")}
                    </span>
                  )}
                  {item.done && item.done_at && (
                    <span className="text-emerald-400/70">
                      listo el {new Date(item.done_at).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}
                    </span>
                  )}
                </div>
                {item.notes && <p className="mt-1.5 text-xs text-white/45">{item.notes}</p>}
              </div>

              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => setEditing(item.id)} aria-label="Editar"
                  className="rounded-md p-1.5 text-white/30 transition hover:bg-white/5 hover:text-white">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => remove(item.id, item.title)} aria-label="Eliminar"
                  className="rounded-md p-1.5 text-white/30 transition hover:bg-red-500/10 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
