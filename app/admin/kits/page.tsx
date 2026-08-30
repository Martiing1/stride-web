import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { formatCLP } from "@/lib/site";
import { KitsManager, type DeliveryRow, type MemberOption } from "@/components/admin/KitsManager";
import type { InventoryItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KitsPage() {
  const member = await requireTeamMember();
  const supabase = await createClient();

  // Los nombres de miembros salen del cliente de servicio a propósito: desde la
  // migración 003 la tabla `members` es solo del dueño, y con la sesión normal
  // un líder veía "Miembro eliminado" en cada entrega. La página ya exige
  // pertenecer al equipo, y de acá solo salen id y nombre.
  const service = createServiceClient();

  const [{ data: itemsData }, { data: deliveriesData }, { data: membersData }] = await Promise.all([
    supabase.from("inventory_items").select("*").order("name").order("size"),
    service
      .from("kit_deliveries")
      .select("id, status, quantity, members(full_name), inventory_items(name, size)")
      .order("created_at", { ascending: false })
      .limit(50),
    service.from("members").select("id, full_name").eq("status", "activa").order("full_name"),
  ]);

  const items = (itemsData ?? []) as InventoryItem[];
  const deliveries = (deliveriesData ?? []) as unknown as DeliveryRow[];
  const members = (membersData ?? []) as MemberOption[];

  const pendientes = deliveries.filter((d) => d.status === "pendiente");
  const valorStock = items.reduce((sum, i) => sum + i.stock * (i.unit_cost_clp ?? 0), 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Kits e inventario</h1>
        <p className="mt-1 text-white/50">
          {pendientes.length} kits pendientes de entrega · stock valorizado en {formatCLP(valorStock)}
        </p>
        <Link
          href="/admin/membresia"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-stride-cyan hover:underline"
        >
          Ver el plan del mes de la membresía <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {pendientes.length > 0 && (
        <p className="card flex items-start gap-2 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Hay {pendientes.length} kits sin entregar. Coordina el retiro en el próximo Social Run.
        </p>
      )}

      <KitsManager
        items={items}
        deliveries={deliveries}
        members={members}
        canDelete={member.role === "socio"}
      />
    </div>
  );
}
