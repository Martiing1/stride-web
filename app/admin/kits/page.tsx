import { Package, AlertTriangle } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCLP } from "@/lib/site";
import type { InventoryItem } from "@/lib/types";

export const dynamic = "force-dynamic";

interface DeliveryRow {
  id: string;
  status: "pendiente" | "entregado";
  quantity: number;
  members: { full_name: string } | null;
  inventory_items: { name: string; size: string | null } | null;
}

export default async function KitsPage() {
  await requireTeamMember();
  const supabase = await createClient();

  const [{ data: itemsData }, { data: deliveriesData }] = await Promise.all([
    supabase.from("inventory_items").select("*").order("name").order("size"),
    supabase
      .from("kit_deliveries")
      .select("id, status, quantity, members(full_name), inventory_items(name, size)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const items = (itemsData ?? []) as InventoryItem[];
  const deliveries = (deliveriesData ?? []) as unknown as DeliveryRow[];

  const pendientes = deliveries.filter((d) => d.status === "pendiente");
  const valorStock = items.reduce((sum, i) => sum + i.stock * (i.unit_cost_clp ?? 0), 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Kits e inventario</h1>
        <p className="mt-1 text-white/50">
          {pendientes.length} kits pendientes de entrega · stock valorizado en{" "}
          {formatCLP(valorStock)}
        </p>
      </header>

      <section>
        <h2 className="mb-4 font-heading text-xl font-bold text-white">Stock</h2>
        {items.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={`card flex items-center justify-between gap-3 py-4 ${
                  item.stock === 0 ? "border-amber-500/30" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {item.name}
                    {item.size && <span className="ml-1.5 text-white/40">· {item.size}</span>}
                  </p>
                  {item.unit_cost_clp && (
                    <p className="text-xs text-white/35">{formatCLP(item.unit_cost_clp)} c/u</p>
                  )}
                </div>
                <span
                  className={`shrink-0 font-heading text-2xl font-extrabold ${
                    item.stock === 0 ? "text-amber-400" : "text-white"
                  }`}
                >
                  {item.stock}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card flex flex-col items-center gap-3 py-12 text-center">
            <Package className="h-9 w-9 text-white/25" />
            <p className="text-sm text-white/50">
              No hay artículos cargados. Corre el seed o agrégalos en Supabase.
            </p>
          </div>
        )}
      </section>

      {deliveries.length > 0 && (
        <section>
          <h2 className="mb-4 font-heading text-xl font-bold text-white">Entregas recientes</h2>
          <ul className="space-y-2">
            {deliveries.map((d) => (
              <li key={d.id} className="card flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">
                    {d.members?.full_name ?? "Miembro eliminado"}
                  </p>
                  <p className="text-xs text-white/40">
                    {d.inventory_items?.name}
                    {d.inventory_items?.size && ` · ${d.inventory_items.size}`}
                    {d.quantity > 1 && ` · x${d.quantity}`}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    d.status === "entregado"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {d.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendientes.length > 0 && (
        <p className="card flex items-start gap-2 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Hay {pendientes.length} kits sin entregar. Coordina el retiro en el próximo Social Run.
        </p>
      )}
    </div>
  );
}
