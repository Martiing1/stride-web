"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Check, Loader2, Minus, Package, PackagePlus, Pencil, Plus, Trash2, Truck, X } from "lucide-react";
import {
  adjustStock,
  createDelivery,
  createInventoryItem,
  deleteInventoryItem,
  markDelivered,
  updateInventoryItem,
} from "@/app/admin/kits/actions";
import { formatCLP } from "@/lib/site";
import type { InventoryItem } from "@/lib/types";

export interface DeliveryRow {
  id: string;
  status: "pendiente" | "entregado";
  quantity: number;
  members: { full_name: string } | null;
  inventory_items: { name: string; size: string | null } | null;
}

export interface MemberOption {
  id: string;
  full_name: string;
}

/** Inventario y entregas de kits. Era la única sección de solo lectura del ERP. */
export function KitsManager({
  items,
  deliveries,
  members,
  canDelete,
}: {
  items: InventoryItem[];
  deliveries: DeliveryRow[];
  members: MemberOption[];
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [creatingDelivery, setCreatingDelivery] = useState(false);

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold text-white">Stock</h2>
          {!creatingItem && (
            <button type="button" onClick={() => setCreatingItem(true)} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:text-white">
              <Plus className="h-4 w-4" /> Agregar artículo
            </button>
          )}
        </div>

        {creatingItem && (
          <div className="mb-4">
            <ItemForm title="Nuevo artículo" action={createInventoryItem} onDone={() => setCreatingItem(false)} onCancel={() => setCreatingItem(false)} />
          </div>
        )}

        {items.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) =>
              editing === item.id ? (
                <div key={item.id} className="sm:col-span-2 lg:col-span-3">
                  <ItemForm title={`Editar ${item.name}`} item={item} action={updateInventoryItem} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
                </div>
              ) : (
                <ItemCard key={item.id} item={item} canDelete={canDelete} onEdit={() => setEditing(item.id)} />
              )
            )}
          </div>
        ) : (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <Package className="h-9 w-9 text-white/25" />
            <p className="text-sm text-white/50">No hay artículos cargados todavía.</p>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold text-white">Entregas</h2>
          {!creatingDelivery && items.length > 0 && members.length > 0 && (
            <button type="button" onClick={() => setCreatingDelivery(true)} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:text-white">
              <PackagePlus className="h-4 w-4" /> Registrar entrega
            </button>
          )}
        </div>

        {creatingDelivery && (
          <div className="mb-4">
            <DeliveryForm items={items} members={members} onDone={() => setCreatingDelivery(false)} onCancel={() => setCreatingDelivery(false)} />
          </div>
        )}

        {deliveries.length > 0 ? (
          <ul className="space-y-2">
            {deliveries.map((delivery) => <DeliveryRowItem key={delivery.id} delivery={delivery} />)}
          </ul>
        ) : (
          <p className="card py-8 text-center text-sm text-white/40">Sin entregas registradas.</p>
        )}
      </section>
    </div>
  );
}

function ItemCard({ item, canDelete, onEdit }: { item: InventoryItem; canDelete: boolean; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function adjust(delta: number) {
    const form = new FormData();
    form.set("id", item.id);
    form.set("delta", String(delta));
    startTransition(async () => {
      await adjustStock(form);
    });
  }

  function remove() {
    if (!window.confirm(`¿Borrar ${item.name}?`)) return;
    const form = new FormData();
    form.set("id", item.id);
    setError(null);
    startTransition(async () => {
      const result = await deleteInventoryItem(form);
      if (!result.ok) setError(result.error ?? "No se pudo borrar.");
    });
  }

  return (
    <div className={`card space-y-3 ${item.stock === 0 ? "border-amber-500/30" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {item.name}
            {item.size && <span className="ml-1.5 text-white/40">· {item.size}</span>}
          </p>
          {item.unit_cost_clp && <p className="text-xs text-white/35">{formatCLP(item.unit_cost_clp)} c/u</p>}
        </div>
        <span className={`shrink-0 font-heading text-2xl font-extrabold ${item.stock === 0 ? "text-amber-400" : "text-white"}`}>
          {item.stock}
        </span>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      <div className="flex items-center gap-1.5 border-t border-white/5 pt-3">
        <button type="button" onClick={() => adjust(-1)} disabled={pending || item.stock === 0} className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white disabled:opacity-30" aria-label="Restar uno">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => adjust(1)} disabled={pending} className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white" aria-label="Sumar uno">
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onEdit} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/60 hover:text-white">
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        {canDelete && (
          <button type="button" onClick={remove} disabled={pending} className="rounded-lg border border-white/10 p-1.5 text-white/30 hover:border-red-400/40 hover:text-red-300" aria-label="Borrar artículo">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function DeliveryRowItem({ delivery }: { delivery: DeliveryRow }) {
  const [pending, startTransition] = useTransition();

  function deliver() {
    const form = new FormData();
    form.set("id", delivery.id);
    startTransition(async () => {
      await markDelivered(form);
    });
  }

  return (
    <li className="card flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-white">{delivery.members?.full_name ?? "Miembro eliminado"}</p>
        <p className="text-xs text-white/40">
          {delivery.inventory_items?.name}
          {delivery.inventory_items?.size && ` · ${delivery.inventory_items.size}`}
          {delivery.quantity > 1 && ` · x${delivery.quantity}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${delivery.status === "entregado" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
          {delivery.status}
        </span>
        {delivery.status === "pendiente" && (
          <button type="button" onClick={deliver} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />} Marcar entregada
          </button>
        )}
      </div>
    </li>
  );
}

function ItemForm({
  title,
  item,
  action,
  onDone,
  onCancel,
}: {
  title: string;
  item?: InventoryItem;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (item) form.set("id", item.id);
    setError(null);
    startTransition(async () => {
      const result = await action(form);
      if (result.ok) onDone();
      else setError(result.error ?? "No se pudo guardar.");
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h3 className="font-heading text-lg font-bold text-white">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="name" className="label">Artículo</label>
          <input id="name" name="name" required defaultValue={item?.name} className="input" placeholder="Polera" />
        </div>
        <div>
          <label htmlFor="category" className="label">Categoría</label>
          <input id="category" name="category" defaultValue={item?.category ?? ""} className="input" placeholder="ropa" />
        </div>
        <div>
          <label htmlFor="size" className="label">Talla</label>
          <input id="size" name="size" defaultValue={item?.size ?? ""} className="input" placeholder="M" />
        </div>
        <div>
          <label htmlFor="stock" className="label">Stock</label>
          <input id="stock" name="stock" type="number" min={0} defaultValue={item?.stock ?? 0} className="input" />
        </div>
      </div>
      <div className="sm:max-w-[220px]">
        <label htmlFor="unit_cost_clp" className="label">Costo unitario (CLP)</label>
        <input id="unit_cost_clp" name="unit_cost_clp" type="number" min={0} defaultValue={item?.unit_cost_clp ?? ""} className="input" placeholder="8990" />
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

function DeliveryForm({
  items,
  members,
  onDone,
  onCancel,
}: {
  items: InventoryItem[];
  members: MemberOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createDelivery(form);
      if (result.ok) onDone();
      else setError(result.error ?? "No se pudo registrar.");
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h3 className="font-heading text-lg font-bold text-white">Registrar entrega</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="member_id" className="label">Miembro</label>
          <select id="member_id" name="member_id" required className="input">
            <option value="">Elige…</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="item_id" className="label">Artículo</label>
          <select id="item_id" name="item_id" required className="input">
            <option value="">Elige…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}{i.size ? ` · ${i.size}` : ""} ({i.stock})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="quantity" className="label">Cantidad</label>
          <input id="quantity" name="quantity" type="number" min={1} defaultValue={1} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="label">Nota</label>
        <input id="notes" name="notes" className="input" placeholder="Retira en el Social Run del sábado" />
      </div>

      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Registrar</>}
        </button>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-white/60 hover:text-white">
          <X className="h-4 w-4" /> Cancelar
        </button>
      </div>
    </form>
  );
}
