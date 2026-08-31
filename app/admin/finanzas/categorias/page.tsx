import Link from "next/link";
import { ArrowLeft, Tags } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FinanceCategoriesManager, type CatRow } from "@/components/admin/FinanceCategoriesManager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Categorías de finanzas" };

export default async function CategoriasPage() {
  await requireTeamMember(["socio"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("finance_categories")
    .select("id, kind, name, parent_id")
    .eq("active", true)
    .order("sort_order")
    .order("name");

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/finanzas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Finanzas
        </Link>
        <h1 className="flex items-center gap-2.5 font-heading text-3xl font-extrabold text-white">
          <Tags className="h-7 w-7 text-stride-cyan" /> Categorías
        </h1>
        <p className="mt-1 max-w-2xl text-white/50">
          El catálogo que ofrecen los formularios de movimientos: ingresos, costos (producir el
          servicio) y gastos (operar), con sus subcategorías.
        </p>
      </header>

      {error ? (
        <p className="card py-10 text-center text-sm text-white/40">
          Corre la migración 007 para activar el catálogo.
        </p>
      ) : (
        <FinanceCategoriesManager rows={(data ?? []) as CatRow[]} />
      )}
    </div>
  );
}
