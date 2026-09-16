import { getCurrentMember, getCommunityStaff } from "@/lib/member-auth";
import { getChallenges, getChallengesAdmin, getMedalOptions, getMonthlyRanking } from "@/lib/community";
import { ChallengeCard } from "@/components/community/ChallengeCard";
import { HitoTile } from "@/components/community/HitoTile";
import { ChallengeAdminPanel } from "@/components/community/ChallengeAdminPanel";
import { addDaysIso, weekStartChile } from "@/lib/membership";

export const dynamic = "force-dynamic";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "14 al 20 de septiembre" o "31 de agosto al 6 de septiembre". */
function formatRange(from: string, to: string): string {
  const [, fm, fd] = from.split("-").map(Number);
  const [, tm, td] = to.split("-").map(Number);
  return fm === tm ? `${fd} al ${td} de ${MONTHS[tm - 1]}` : `${fd} de ${MONTHS[fm - 1]} al ${td} de ${MONTHS[tm - 1]}`;
}

/** Retos: del mes, micro-retos, generales e hitos permanentes. */
export default async function RetosPage() {
  const [member, staff] = await Promise.all([getCurrentMember(), getCommunityStaff()]);
  const viewerId = member?.id ?? "00000000-0000-0000-0000-000000000000";
  const [challenges, ranking, adminChallenges, medals] = await Promise.all([
    getChallenges(viewerId),
    getMonthlyRanking(viewerId),
    staff ? getChallengesAdmin() : Promise.resolve([]),
    staff ? getMedalOptions() : Promise.resolve([]),
  ]);

  const delMes = challenges.filter((c) => c.period === "mes");
  const micro = challenges.filter((c) => c.period === "semana");
  const generales = challenges.filter((c) => c.period === "general");
  const hitos = challenges.filter((c) => c.period === "hito");
  const monthName = MONTHS[new Date().getMonth()];
  // Micro-retos: semana en curso (lunes a domingo, hora Chile); se reinician cada lunes.
  const weekStart = weekStartChile();
  const weekLabel = formatRange(weekStart, addDaysIso(weekStart, 6));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-bold">Retos</h1>
        <span className="rounded-full border border-[var(--sline)] bg-[var(--scard)] px-3.5 py-1.5 text-xs font-bold">
          {ranking.mine} pts este mes
        </span>
      </div>

      {staff && <ChallengeAdminPanel challenges={adminChallenges} medals={medals} />}

      {challenges.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--sline2)] p-10 text-center">
          <p className="font-heading font-bold">Los retos del mes vienen en camino</p>
          <p className="mt-1 text-sm text-[var(--smut)]">El staff los publica aquí. Atento a la campana.</p>
        </div>
      )}

      {delMes.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">
            Retos del mes · {monthName}
          </h2>
          {delMes.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} highlight />
          ))}
        </section>
      )}

      {micro.length > 0 && (
        <section className="space-y-3">
          <div className="px-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">
              Micro-retos de la semana · {weekLabel}
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--sdim)]">Se reinician cada lunes.</p>
          </div>
          {micro.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </section>
      )}

      {generales.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">
            Retos generales
          </h2>
          {generales.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </section>
      )}

      {hitos.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">
            Hitos permanentes
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {hitos.map((hito) => (
              <HitoTile key={hito.id} hito={hito} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
