import { requireTeamMember } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { ChallengeManager, type AdminChallenge } from "@/components/admin/CommunityTools";

export const dynamic = "force-dynamic";
export const metadata = { title: "Retos" };

export default async function AdminRetosPage() {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const service = createServiceClient();

  const [challenges, medals] = await Promise.all([
    safeQuery(
      () =>
        service
          .from("challenges")
          .select("id, title, period, criterio, goal, points, active, medals:medal_id(name)")
          .order("created_at", { ascending: false })
          .returns<Array<{ id: string; title: string; period: string; criterio: string; goal: number; points: number; active: boolean; medals: { name: string } | null }>>(),
      [] as Array<{ id: string; title: string; period: string; criterio: string; goal: number; points: number; active: boolean; medals: { name: string } | null }>
    ),
    safeQuery(
      () => service.from("medals").select("id, name").eq("active", true).order("name"),
      [] as Array<{ id: string; name: string }>
    ),
  ]);

  const rows: AdminChallenge[] = challenges.map((challenge) => ({
    id: challenge.id,
    title: challenge.title,
    period: challenge.period,
    criterio: challenge.criterio,
    goal: challenge.goal,
    points: challenge.points,
    active: challenge.active,
    medal_name: challenge.medals?.name ?? null,
  }));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Retos</h1>
        <p className="mt-1 text-white/50">
          Los retos del mes y micro-retos se crean para el mes en curso. Los hitos y generales no expiran.
        </p>
      </header>
      <ChallengeManager challenges={rows} medals={medals} />
    </div>
  );
}
