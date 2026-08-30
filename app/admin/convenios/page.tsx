import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BenefitsManager } from "@/components/admin/BenefitsManager";
import type { Benefit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConveniosPage() {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("benefits")
    .select("*")
    .order("sort_order")
    .order("business_name");
  const benefits = (data ?? []) as Benefit[];

  const activos = benefits.filter((b) => b.active).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Convenios</h1>
        <p className="mt-1 text-white/50">
          {benefits.length} en total · {activos} activos y visibles en /one y en los carnets
        </p>
      </header>

      <BenefitsManager benefits={benefits} />
    </div>
  );
}
