import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RoutesManager } from "@/components/admin/RoutesManager";
import type { Route } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RutasPage() {
  await requireTeamMember();
  const supabase = await createClient();

  const { data } = await supabase
    .from("routes")
    .select("*")
    .order("active", { ascending: false })
    .order("name");

  const routes = (data ?? []) as Route[];
  const activas = routes.filter((r) => r.active).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Rutas</h1>
        <p className="mt-1 max-w-2xl text-white/50">
          {activas} rutas activas. Se trazan una vez y se reutilizan en cada Social Run, con
          su GPX y sus advertencias de seguridad.
        </p>
      </header>

      <RoutesManager routes={routes} />
    </div>
  );
}
