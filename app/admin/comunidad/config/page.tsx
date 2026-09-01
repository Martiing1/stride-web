import { requireTeamMember } from "@/lib/auth";
import { getPointsWeights } from "@/lib/community";
import { PointsConfigForm } from "@/components/admin/CommunityTools";

export const dynamic = "force-dynamic";
export const metadata = { title: "Puntos de la comunidad" };

export default async function ComunidadConfigPage() {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const weights = await getPointsWeights();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Puntos</h1>
        <p className="mt-1 text-white/50">
          Cuánto vale cada acción de la comunidad. Los cambios rigen desde el próximo punto otorgado; lo ya
          pagado no se recalcula.
        </p>
      </header>
      <PointsConfigForm initial={weights} />
    </div>
  );
}
