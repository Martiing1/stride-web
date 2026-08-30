import { TrendingUp, TrendingDown, Wallet, LineChart } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { formatCLP, SITE } from "@/lib/site";
import { todayInChile } from "@/lib/membership";
import { FinanceManager } from "@/components/admin/FinanceManager";
import type { Transaction, StrideEvent, MonthlyFinanceSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export default async function FinanzasPage() {
  await requireTeamMember(["socio"]);
  const supabase = await createClient();

  const today = todayInChile();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [{ data: txData }, { count: activeMembers }, { data: eventsData }, { data: summaryData }] =
    await Promise.all([
      supabase.from("transactions").select("*").order("occurred_on", { ascending: false }).limit(300),
      // El conteo va por el cliente de servicio: `members` es solo del dueño y
      // con la sesión de otro socio la proyección de ingresos daba 0 sin avisar.
      createServiceClient().from("members").select("*", { count: "exact", head: true }).eq("status", "activa"),
      supabase.from("events").select("*").order("event_date", { ascending: false }).limit(40),
      supabase.from("monthly_finance_summary").select("*").limit(12),
    ]);

  const transactions = (txData ?? []) as Transaction[];
  const summary = (summaryData ?? []) as MonthlyFinanceSummary[];

  const thisMonth = transactions.filter((t) => t.occurred_on >= monthStart);
  const ingresos = thisMonth.filter((t) => t.kind === "ingreso").reduce((s, t) => s + t.amount_clp, 0);
  const gastos = thisMonth.filter((t) => t.kind === "gasto").reduce((s, t) => s + t.amount_clp, 0);
  const resultado = ingresos - gastos;

  // Proyección: lo que entra si todos los miembros activos siguen pagando.
  const mrr = (activeMembers ?? 0) * SITE.membership.priceCLP;

  const maxAbs = Math.max(
    1,
    ...summary.map((s) => Math.max(s.ingresos ?? 0, s.gastos ?? 0))
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Finanzas</h1>
        <p className="mt-1 text-white/50">Movimientos, balance mensual y proyección.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Ingresos del mes", value: formatCLP(ingresos), icon: TrendingUp, tone: "text-emerald-400" },
          { label: "Gastos del mes", value: formatCLP(gastos), icon: TrendingDown, tone: "text-red-400" },
          {
            label: "Resultado",
            value: formatCLP(resultado),
            icon: Wallet,
            tone: resultado >= 0 ? "text-emerald-400" : "text-red-400",
          },
          { label: "Proyección membresía", value: formatCLP(mrr), icon: LineChart, tone: "text-stride-cyan" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card">
            <div className="flex items-start justify-between">
              <p className="text-sm text-white/50">{label}</p>
              <Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <p className={`mt-1 font-heading text-2xl font-extrabold ${tone}`}>{value}</p>
          </div>
        ))}
      </section>

      <p className="card text-xs leading-relaxed text-white/40">
        La proyección es teórica: {activeMembers ?? 0} miembros activos ×{" "}
        {SITE.membership.priceLabel}. Como el cobro se hace en Skool, contrástala con lo que
        efectivamente llegó ahí antes de tomarla como ingreso.
      </p>

      {/* Balance mensual */}
      {summary.length > 0 && (
        <section className="card">
          <h2 className="mb-5 font-heading text-lg font-bold text-white">Balance mensual</h2>
          <ul className="space-y-3">
            {summary.map((s) => {
              const ing = s.ingresos ?? 0;
              const gas = s.gastos ?? 0;
              return (
                <li key={s.month}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-white/70">{monthLabel(s.month)}</span>
                    <span className={`font-heading font-bold ${s.resultado >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {s.resultado >= 0 ? "+" : "−"}{formatCLP(Math.abs(s.resultado))}
                    </span>
                  </div>
                  {/* Dos barras a la misma escala: comparables entre meses. */}
                  <div className="space-y-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${(ing / maxAbs) * 100}%` }} />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-red-500"
                        style={{ width: `${(gas / maxAbs) * 100}%` }} />
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-white/35">
                    {formatCLP(ing)} ingresos · {formatCLP(gas)} gastos · {s.movimientos} movimientos
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <FinanceManager
        transactions={transactions}
        events={(eventsData ?? []) as StrideEvent[]}
        today={today}
      />
    </div>
  );
}
