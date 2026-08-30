import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/membership";
import { BudgetsManager, type BudgetRow } from "@/components/admin/BudgetsManager";
import { formatCLP } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = { title: "Presupuestos" };

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requireTeamMember(["socio"]);
  const { mes } = await searchParams;
  const today = todayInChile();
  const period = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : today.slice(0, 7);
  const [year, month] = period.split("-").map(Number);
  const supabase = await createClient();

  // Trimestre calendario del mes elegido (Q1: ene-mar, Q2: abr-jun, …)
  const qStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
  const qStart = `${year}-${String(qStartMonth).padStart(2, "0")}-01`;
  const qEnd = new Date(Date.UTC(year, qStartMonth + 2, 0)).toISOString().slice(0, 10);

  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const [{ data: budgetsData }, { data: txData }, { data: qBudgets }, { data: qTx }] = await Promise.all([
    supabase.from("budgets").select("*").eq("year", year).eq("month", month).order("category"),
    supabase
      .from("transactions")
      .select("kind, category, amount_clp")
      .gte("occurred_on", `${period}-01`)
      .lte("occurred_on", monthEnd),
    supabase
      .from("budgets")
      .select("kind, planned_clp, month")
      .eq("year", year)
      .in("month", [qStartMonth, qStartMonth + 1, qStartMonth + 2]),
    supabase.from("transactions").select("kind, amount_clp").gte("occurred_on", qStart).lte("occurred_on", qEnd),
  ]);

  const qPlannedGasto = (qBudgets ?? []).filter((b) => b.kind === "gasto").reduce((s, b) => s + b.planned_clp, 0);
  const qRealGasto = (qTx ?? []).filter((t) => t.kind === "gasto").reduce((s, t) => s + t.amount_clp, 0);
  const qPlannedIngreso = (qBudgets ?? []).filter((b) => b.kind === "ingreso").reduce((s, b) => s + b.planned_clp, 0);
  const qRealIngreso = (qTx ?? []).filter((t) => t.kind === "ingreso").reduce((s, t) => s + t.amount_clp, 0);
  const quarterLabel = `Q${Math.floor((month - 1) / 3) + 1} ${year}`;

  const actual = new Map<string, number>();
  for (const t of txData ?? []) {
    const key = `${t.kind}:${(t.category as string).toLowerCase()}`;
    actual.set(key, (actual.get(key) ?? 0) + (t.amount_clp as number));
  }

  const rows: BudgetRow[] = ((budgetsData ?? []) as Omit<BudgetRow, "actual_clp">[]).map((b) => ({
    ...b,
    actual_clp: actual.get(`${b.kind}:${b.category.toLowerCase()}`) ?? 0,
  }));

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/finanzas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Finanzas
        </Link>
        <h1 className="flex items-center gap-2.5 font-heading text-3xl font-extrabold text-white">
          <Target className="h-7 w-7 text-stride-cyan" /> Presupuestos
        </h1>
        <p className="mt-1 max-w-2xl text-white/50">
          Metas del mes por categoría contra lo que realmente entró y salió del libro diario.
        </p>
      </header>

      <form className="flex items-end gap-3" method="get">
        <div>
          <label htmlFor="mes" className="label">Mes</label>
          <input id="mes" name="mes" type="month" defaultValue={period} className="input w-auto py-2 text-sm" />
        </div>
        <button type="submit" className="btn-secondary px-5 py-2 text-sm">Ver</button>
      </form>

      {(qPlannedGasto > 0 || qPlannedIngreso > 0) && (
        <section className="card">
          <h2 className="mb-3 font-heading text-lg font-bold text-white">Trimestre {quarterLabel}</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/[0.03] p-4">
              <dt className="text-xs uppercase tracking-wide text-white/35">Gastos</dt>
              <dd className={`mt-1 font-heading text-xl font-extrabold ${qRealGasto > qPlannedGasto ? "text-red-400" : "text-white"}`}>
                {formatCLP(qRealGasto)} <span className="text-sm font-normal text-white/40">de {formatCLP(qPlannedGasto)} presupuestados</span>
              </dd>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-4">
              <dt className="text-xs uppercase tracking-wide text-white/35">Ingresos</dt>
              <dd className="mt-1 font-heading text-xl font-extrabold text-white">
                {formatCLP(qRealIngreso)} <span className="text-sm font-normal text-white/40">de {formatCLP(qPlannedIngreso)} proyectados</span>
              </dd>
            </div>
          </dl>
        </section>
      )}

      <BudgetsManager rows={rows} year={year} month={month} />
    </div>
  );
}
