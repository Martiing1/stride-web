import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCLP } from "@/lib/site";
import { formatDateCL } from "@/lib/membership";
import type { Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Libro diario" };

/**
 * Libro diario: todos los movimientos, filtrables, con saldo acumulado.
 * Es la vista "contable" básica que pidió Martín; lo fino (cuentas, IVA,
 * conciliación) queda para cuando la SpA lo exija.
 */
export default async function LibroDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; tipo?: string; categoria?: string }>;
}) {
  await requireTeamMember(["socio"]);
  const { mes, tipo, categoria } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("transactions").select("*").order("occurred_on").order("created_at");
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    query = query.gte("occurred_on", `${mes}-01`).lte("occurred_on", end);
  }
  if (tipo === "ingreso" || tipo === "gasto") query = query.eq("kind", tipo);
  if (categoria) query = query.eq("category", categoria);

  const [{ data: txData }, { data: allCats }] = await Promise.all([
    query,
    supabase.from("transactions").select("category"),
  ]);
  const transactions = (txData ?? []) as Transaction[];
  const categories = Array.from(new Set((allCats ?? []).map((c) => c.category as string))).sort();

  let running = 0;
  const rows = transactions.map((t) => {
    running += t.kind === "ingreso" ? t.amount_clp : -t.amount_clp;
    return { ...t, balance: running };
  });
  const ingresos = transactions.filter((t) => t.kind === "ingreso").reduce((s, t) => s + t.amount_clp, 0);
  const gastos = transactions.filter((t) => t.kind === "gasto").reduce((s, t) => s + t.amount_clp, 0);

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/finanzas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Finanzas
        </Link>
        <h1 className="flex items-center gap-2.5 font-heading text-3xl font-extrabold text-white">
          <BookOpen className="h-7 w-7 text-stride-cyan" /> Libro diario
        </h1>
        <p className="mt-1 text-white/50">
          {rows.length} movimientos{mes ? ` en ${mes}` : ""} · {formatCLP(ingresos)} ingresos · {formatCLP(gastos)} gastos
        </p>
      </header>

      {/* Filtros por URL: simples y compartibles */}
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div>
          <label htmlFor="mes" className="label">Mes</label>
          <input id="mes" name="mes" type="month" defaultValue={mes ?? ""} className="input w-auto py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="tipo" className="label">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={tipo ?? ""} className="input w-auto py-2 text-sm">
            <option value="" className="bg-stride-card">Todos</option>
            <option value="ingreso" className="bg-stride-card">Ingresos</option>
            <option value="gasto" className="bg-stride-card">Gastos</option>
          </select>
        </div>
        <div>
          <label htmlFor="categoria" className="label">Categoría</label>
          <select id="categoria" name="categoria" defaultValue={categoria ?? ""} className="input w-auto py-2 text-sm">
            <option value="" className="bg-stride-card">Todas</option>
            {categories.map((c) => <option key={c} value={c} className="bg-stride-card">{c}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-secondary px-5 py-2 text-sm">Filtrar</button>
        {(mes || tipo || categoria) && (
          <Link href="/admin/finanzas/libro" className="py-2 text-sm text-white/45 hover:text-white">Limpiar</Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="card py-10 text-center text-sm text-white/40">Sin movimientos con estos filtros.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wide text-white/35">
                <th className="p-3 font-medium">Fecha</th>
                <th className="p-3 font-medium">Detalle</th>
                <th className="p-3 font-medium">Categoría</th>
                <th className="p-3 text-right font-medium">Ingreso</th>
                <th className="p-3 text-right font-medium">Gasto</th>
                <th className="p-3 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-white/5 last:border-0">
                  <td className="whitespace-nowrap p-3 text-white/55">{formatDateCL(t.occurred_on)}</td>
                  <td className="p-3 text-white">{t.description ?? "—"}</td>
                  <td className="p-3"><span className="rounded-full bg-white/5 px-2 py-0.5 text-xs capitalize text-white/60">{t.category}</span></td>
                  <td className="whitespace-nowrap p-3 text-right text-emerald-400">{t.kind === "ingreso" ? formatCLP(t.amount_clp) : ""}</td>
                  <td className="whitespace-nowrap p-3 text-right text-red-400">{t.kind === "gasto" ? formatCLP(t.amount_clp) : ""}</td>
                  <td className={`whitespace-nowrap p-3 text-right font-semibold ${t.balance >= 0 ? "text-white" : "text-red-300"}`}>{formatCLP(t.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
