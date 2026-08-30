import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/membership";
import { BudgetsManager, type BudgetRow } from "@/components/admin/BudgetsManager";

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

  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const [{ data: budgetsData }, { data: txData }] = await Promise.all([
    supabase.from("budgets").select("*").eq("year", year).eq("month", month).order("category"),
    supabase
      .from("transactions")
      .select("kind, category, amount_clp")
      .gte("occurred_on", `${period}-01`)
      .lte("occurred_on", monthEnd),
  ]);

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

      <BudgetsManager rows={rows} year={year} month={month} />
    </div>
  );
}
