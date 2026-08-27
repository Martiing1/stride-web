import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCLP, SITE } from "@/lib/site";
import { todayInChile } from "@/lib/membership";
import type { Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FinanzasPage() {
  await requireTeamMember(["socio"]);
  const supabase = await createClient();

  const today = todayInChile();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [{ data: txData }, { count: activeMembers }] = await Promise.all([
    supabase.from("transactions").select("*").order("occurred_on", { ascending: false }).limit(100),
    supabase.from("members").select("*", { count: "exact", head: true }).eq("status", "activa"),
  ]);

  const transactions = (txData ?? []) as Transaction[];
  const thisMonth = transactions.filter((t) => t.occurred_on >= monthStart);

  const ingresos = thisMonth
    .filter((t) => t.kind === "ingreso")
    .reduce((sum, t) => sum + t.amount_clp, 0);
  const gastos = thisMonth
    .filter((t) => t.kind === "gasto")
    .reduce((sum, t) => sum + t.amount_clp, 0);

  // Ingreso recurrente teórico de la membresía, para contrastarlo con lo registrado.
  const mrr = (activeMembers ?? 0) * SITE.membership.priceCLP;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Finanzas</h1>
        <p className="mt-1 text-white/50">Movimientos del mes en curso.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Ingresos del mes", value: formatCLP(ingresos), icon: TrendingUp, tone: "text-emerald-400" },
          { label: "Gastos del mes", value: formatCLP(gastos), icon: TrendingDown, tone: "text-red-400" },
          {
            label: "Resultado",
            value: formatCLP(ingresos - gastos),
            icon: Wallet,
            tone: ingresos - gastos >= 0 ? "text-emerald-400" : "text-red-400",
          },
          {
            label: "MRR membresía",
            value: formatCLP(mrr),
            icon: TrendingUp,
            tone: "text-stride-accent",
          },
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
        El MRR es teórico: {activeMembers ?? 0} miembros activos ×{" "}
        {SITE.membership.priceLabel}. Como el cobro se hace en Skool, contrástalo con lo que
        efectivamente llegó ahí.
      </p>

      <section>
        <h2 className="mb-4 font-heading text-xl font-bold text-white">Movimientos</h2>
        {transactions.length > 0 ? (
          <ul className="space-y-2">
            {transactions.map((t) => (
              <li key={t.id} className="card flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{t.description ?? t.category}</p>
                  <p className="text-xs text-white/40">
                    {t.occurred_on.split("-").reverse().join("/")} · {t.category}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-heading font-bold ${
                    t.kind === "ingreso" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {t.kind === "ingreso" ? "+" : "−"}
                  {formatCLP(t.amount_clp)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <Wallet className="h-9 w-9 text-white/25" />
            <p className="text-sm text-white/50">Todavía no hay movimientos registrados.</p>
          </div>
        )}
      </section>
    </div>
  );
}
