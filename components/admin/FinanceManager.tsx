"use client";

import { useState, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Loader2, Pencil, Trash2, Upload, FileText, TrendingUp, TrendingDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createTransaction, updateTransaction, deleteTransaction,
} from "@/app/admin/finanzas/actions";
import { formatCLP } from "@/lib/site";
import type { Transaction, StrideEvent } from "@/lib/types";

const CATEGORIES = [
  "membresia", "sponsor", "evento", "kits", "premios",
  "produccion", "publicidad", "administracion", "otro",
];

function TxFields({ tx, events, today }: { tx?: Transaction; events: StrideEvent[]; today: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="kind">Tipo</label>
        <select id="kind" name="kind" defaultValue={tx?.kind ?? "gasto"} className="input">
          <option value="ingreso" className="bg-stride-card">Ingreso</option>
          <option value="gasto" className="bg-stride-card">Gasto</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="amount_clp">Monto (CLP)</label>
        <input id="amount_clp" name="amount_clp" type="number" min="0" step="1" required
          defaultValue={tx?.amount_clp ?? ""} className="input" placeholder="31990" />
      </div>
      <div>
        <label className="label" htmlFor="category">Categoría</label>
        <input id="category" name="category" list="cat-list" required
          defaultValue={tx?.category ?? ""} className="input" />
        <datalist id="cat-list">
          {CATEGORIES.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
      <div>
        <label className="label" htmlFor="occurred_on">Fecha</label>
        <input id="occurred_on" name="occurred_on" type="date" required
          defaultValue={tx?.occurred_on ?? today} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="event_id">Evento asociado</label>
        <select id="event_id" name="event_id" defaultValue={tx?.event_id ?? ""} className="input">
          <option value="" className="bg-stride-card">Ninguno</option>
          {events.map((e) => (
            <option key={e.id} value={e.id} className="bg-stride-card">
              {e.title} · {e.event_date.split("-").reverse().join("/")}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="payment_method">Medio de pago</label>
        <input id="payment_method" name="payment_method" defaultValue={tx?.payment_method ?? ""}
          className="input" placeholder="Transferencia, efectivo…" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="description">Descripción</label>
        <input id="description" name="description" defaultValue={tx?.description ?? ""} className="input" />
      </div>
    </div>
  );
}

export function FinanceManager({
  transactions,
  events,
  today,
}: {
  transactions: Transaction[];
  events: StrideEvent[];
  today: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");

  const byCategory = useMemo(() => {
    const map = new Map<string, { ingreso: number; gasto: number }>();
    for (const t of transactions) {
      const cur = map.get(t.category) ?? { ingreso: 0, gasto: 0 };
      cur[t.kind] += t.amount_clp;
      map.set(t.category, cur);
    }
    return [...map.entries()].sort(
      (a, b) => b[1].ingreso + b[1].gasto - (a[1].ingreso + a[1].gasto)
    );
  }, [transactions]);

  async function submit(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    if (id) data.set("id", id);
    if (!id && receiptUrl) data.set("receipt_url", receiptUrl);

    const res = id ? await updateTransaction(data) : await createTransaction(data);
    setBusy(false);

    if (!res.ok) { setError(res.error ?? "No se pudo guardar."); return; }

    form.reset();
    setReceiptUrl("");
    setShowForm(false);
    setEditing(null);
    router.refresh();
  }

  /** Sube el comprobante al bucket privado y devuelve su ruta interna. */
  async function uploadReceipt(file: File, txId: string | "new") {
    setUploading(txId);
    setError(null);

    const path = `${new Date().getFullYear()}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("comprobantes").upload(path, file);

    if (upErr) {
      setError("No se pudo subir el comprobante. ¿Corriste la migración 002?");
      setUploading(null);
      return;
    }

    setUploading(null);
    if (txId === "new") {
      setReceiptUrl(path);
      return;
    }

    const data = new FormData();
    data.set("id", txId);
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;
    data.set("kind", tx.kind);
    data.set("amount_clp", String(tx.amount_clp));
    data.set("category", tx.category);
    data.set("description", tx.description ?? "");
    data.set("occurred_on", tx.occurred_on);
    data.set("event_id", tx.event_id ?? "");
    data.set("payment_method", tx.payment_method ?? "");
    data.set("receipt_url", path);
    await updateTransaction(data);
    router.refresh();
  }

  /** El bucket es privado: se pide una URL firmada al momento de abrir. */
  async function openReceipt(path: string) {
    const { data, error: sErr } = await supabase.storage
      .from("comprobantes")
      .createSignedUrl(path, 60);
    if (sErr || !data) { setError("No se pudo abrir el comprobante."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(tx: Transaction) {
    if (!confirm(`¿Eliminar ${tx.category} por ${formatCLP(tx.amount_clp)}?`)) return;
    const form = new FormData();
    form.set("id", tx.id);
    const res = await deleteTransaction(form);
    if (!res.ok) setError(res.error ?? "No se pudo eliminar.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {!showForm && (
        <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Nuevo movimiento
        </button>
      )}

      {showForm && (
        <form onSubmit={(e) => submit(e)} className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-white">Nuevo movimiento</h2>
            <button type="button" onClick={() => { setShowForm(false); setReceiptUrl(""); }}
              aria-label="Cerrar" className="rounded-lg p-1.5 text-white/40 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <TxFields events={events} today={today} />

          <div>
            <p className="label">Comprobante</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/15 px-4 py-2 text-sm text-white/60 transition hover:border-white/30 hover:text-white">
              {uploading === "new" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</>
              ) : receiptUrl ? (
                <><FileText className="h-4 w-4 text-emerald-400" /> Adjunto listo</>
              ) : (
                <><Upload className="h-4 w-4" /> Adjuntar boleta o transferencia</>
              )}
              <input type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadReceipt(f, "new");
                }} />
            </label>
          </div>

          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
          </button>
        </form>
      )}

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

      {/* Desglose por categoría */}
      {byCategory.length > 0 && (
        <section className="card">
          <h2 className="mb-4 font-heading text-lg font-bold text-white">Por categoría</h2>
          <ul className="space-y-2">
            {byCategory.map(([cat, v]) => (
              <li key={cat} className="flex items-center justify-between gap-4 border-b border-white/5 pb-2 last:border-0">
                <span className="text-sm capitalize text-white/70">{cat}</span>
                <span className="flex gap-4 text-sm">
                  {v.ingreso > 0 && (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <TrendingUp className="h-3.5 w-3.5" />{formatCLP(v.ingreso)}
                    </span>
                  )}
                  {v.gasto > 0 && (
                    <span className="flex items-center gap-1 text-red-400">
                      <TrendingDown className="h-3.5 w-3.5" />{formatCLP(v.gasto)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Movimientos */}
      <section>
        <h2 className="mb-4 font-heading text-xl font-bold text-white">Movimientos</h2>
        {transactions.length === 0 ? (
          <p className="card text-center text-sm text-white/45 py-10">
            Todavía no hay movimientos registrados.
          </p>
        ) : (
          <ul className="space-y-2">
            {transactions.map((tx) =>
              editing === tx.id ? (
                <li key={tx.id}>
                  <form onSubmit={(e) => submit(e, tx.id)} className="card space-y-4">
                    <TxFields tx={tx} events={events} today={today} />
                    <input type="hidden" name="receipt_url" defaultValue={tx.receipt_url ?? ""} />
                    <div className="flex gap-2">
                      <button type="submit" disabled={busy} className="btn-primary px-5 py-2 text-sm">Guardar</button>
                      <button type="button" onClick={() => setEditing(null)} className="btn-secondary px-5 py-2 text-sm">Cancelar</button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={tx.id} className="card flex flex-wrap items-center gap-4 py-3">
                  <div className="min-w-[160px] flex-1">
                    <p className="text-sm text-white">{tx.description || tx.category}</p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {tx.occurred_on.split("-").reverse().join("/")} · {tx.category}
                      {tx.payment_method && ` · ${tx.payment_method}`}
                    </p>
                  </div>

                  <span className={`shrink-0 font-heading font-bold ${tx.kind === "ingreso" ? "text-emerald-400" : "text-red-400"}`}>
                    {tx.kind === "ingreso" ? "+" : "−"}{formatCLP(tx.amount_clp)}
                  </span>

                  <div className="flex shrink-0 gap-1">
                    {tx.receipt_url ? (
                      <button type="button" onClick={() => openReceipt(tx.receipt_url!)}
                        aria-label="Ver comprobante"
                        className="rounded-md p-1.5 text-stride-cyan/70 transition hover:bg-white/5 hover:text-stride-cyan">
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <label className="cursor-pointer rounded-md p-1.5 text-white/25 transition hover:bg-white/5 hover:text-white"
                        aria-label="Adjuntar comprobante">
                        {uploading === tx.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Upload className="h-3.5 w-3.5" />}
                        <input type="file" accept="image/*,application/pdf" className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadReceipt(f, tx.id);
                          }} />
                      </label>
                    )}
                    <button type="button" onClick={() => setEditing(tx.id)} aria-label="Editar"
                      className="rounded-md p-1.5 text-white/30 transition hover:bg-white/5 hover:text-white">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => remove(tx)} aria-label="Eliminar"
                      className="rounded-md p-1.5 text-white/30 transition hover:bg-red-500/10 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
