"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Boxes, Check, Loader2, Plus, Send, Trash2, X } from "lucide-react";
import { createBundle, deleteBundle, deliverBundle } from "@/app/admin/kits/actions";
import type { InventoryItem } from "@/lib/types";
import type { MemberOption } from "@/components/admin/KitsManager";

export interface BundleView {
  id: string;
  name: string;
  notes: string | null;
  items: Array<{ item_id: string; quantity: number; name: string; size: string | null }>;
}

/** Paquetes de kits: un nombre que agrupa varios artículos y se entrega junto. */
export function KitBundles({
  bundles,
  items,
  members,
}: {
  bundles: BundleView[];
  items: InventoryItem[];
  members: MemberOption[];
}) {
  const [creating, setCreating] = useState(false);
  const [rows, setRows] = useState<Array<{ item_id: string; quantity: number }>>([{ item_id: "", quantity: 1 }]);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("items", JSON.stringify(rows.filter((r) => r.item_id)));
    setMessage(null);
    startTransition(async () => {
      const result = await createBundle(form);
      if (result.ok) {
        setCreating(false);
        setRows([{ item_id: "", quantity: 1 }]);
      } else setMessage({ tone: "error", text: result.error ?? "Error" });
    });
  }

  function deliver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    setMessage(null);
    startTransition(async () => {
      const result = await deliverBundle(form);
      setMessage(
        result.ok
          ? { tone: "ok", text: "Paquete registrado como entregas pendientes. Márcalas entregadas cuando se retiren." }
          : { tone: "error", text: result.error ?? "Error" }
      );
      if (result.ok) target.reset();
    });
  }

  function remove(bundle: BundleView) {
    if (!window.confirm(`¿Borrar el paquete «${bundle.name}»? Las entregas ya hechas no se tocan.`)) return;
    const form = new FormData();
    form.set("id", bundle.id);
    startTransition(async () => {
      await deleteBundle(form);
    });
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-white">
          <Boxes className="h-5 w-5 text-stride-cyan" /> Paquetes
        </h2>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:text-white">
            <Plus className="h-4 w-4" /> Crear paquete
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={create} className="card mb-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bundle-name" className="label">Nombre</label>
              <input id="bundle-name" name="name" required className="input" placeholder="Kit de inicio" />
            </div>
            <div>
              <label htmlFor="bundle-notes" className="label">Nota</label>
              <input id="bundle-notes" name="notes" className="input" placeholder="Se entrega al activar la membresía" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="label">Qué incluye</p>
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={row.item_id}
                  onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, item_id: e.target.value } : r)))}
                  className="input flex-1 py-2 text-sm"
                >
                  <option value="" className="bg-stride-card">Elige artículo…</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id} className="bg-stride-card">
                      {item.name}{item.size ? ` · ${item.size}` : ""}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, quantity: Number(e.target.value) || 1 } : r)))}
                  className="input w-20 py-2 text-sm"
                  aria-label="Cantidad"
                />
                <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length === 1} aria-label="Quitar" className="rounded-lg border border-white/10 p-2 text-white/30 hover:text-red-300 disabled:opacity-30">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setRows([...rows, { item_id: "", quantity: 1 }])} className="inline-flex items-center gap-1.5 text-sm text-stride-cyan hover:underline">
              <Plus className="h-3.5 w-3.5" /> Otro artículo
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Crear paquete</>}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-white/60">
              <X className="h-4 w-4" /> Cancelar
            </button>
          </div>
        </form>
      )}

      {message && (
        <p className={`mb-4 rounded-xl border p-3 text-sm ${message.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-red-400/30 bg-red-500/10 text-red-200"}`}>
          {message.text}
        </p>
      )}

      {bundles.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {bundles.map((bundle) => (
            <article key={bundle.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading font-bold text-white">{bundle.name}</h3>
                  {bundle.notes && <p className="text-xs text-white/40">{bundle.notes}</p>}
                </div>
                <button type="button" onClick={() => remove(bundle)} aria-label="Borrar paquete" className="rounded-lg border border-white/10 p-1.5 text-white/25 hover:border-red-400/40 hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <ul className="space-y-1 text-sm text-white/60">
                {bundle.items.map((item) => (
                  <li key={item.item_id}>· {item.quantity}× {item.name}{item.size ? ` (${item.size})` : ""}</li>
                ))}
              </ul>
              {members.length > 0 && (
                <form onSubmit={deliver} className="flex items-center gap-2 border-t border-white/5 pt-3">
                  <input type="hidden" name="bundle_id" value={bundle.id} />
                  <select name="member_id" required className="input flex-1 py-2 text-sm" defaultValue="">
                    <option value="" className="bg-stride-card">Entregar a…</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id} className="bg-stride-card">{m.full_name}</option>
                    ))}
                  </select>
                  <button type="submit" disabled={pending} className="btn-primary px-4 py-2 text-sm">
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Entregar</>}
                  </button>
                </form>
              )}
            </article>
          ))}
        </div>
      ) : (
        !creating && (
          <p className="card py-8 text-center text-sm text-white/40">
            Sin paquetes. Crea el «Kit de inicio»: polera + sticker + lo que corresponda, y se entrega de una.
          </p>
        )
      )}
    </section>
  );
}
