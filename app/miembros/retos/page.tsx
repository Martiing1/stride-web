import { getCurrentMember } from "@/lib/member-auth";
import { getChallenges, getMonthlyRanking } from "@/lib/community";
import { ChallengeCard } from "@/components/community/ChallengeCard";

export const dynamic = "force-dynamic";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Retos: del mes, micro-retos, generales e hitos permanentes. */
export default async function RetosPage() {
  const member = await getCurrentMember();
  const viewerId = member?.id ?? "00000000-0000-0000-0000-000000000000";
  const [challenges, ranking] = await Promise.all([
    getChallenges(viewerId),
    getMonthlyRanking(viewerId),
  ]);

  const delMes = challenges.filter((c) => c.period === "mes");
  const micro = challenges.filter((c) => c.period === "semana");
  const generales = challenges.filter((c) => c.period === "general");
  const hitos = challenges.filter((c) => c.period === "hito");
  const monthName = MONTHS[new Date().getMonth()];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-bold">Retos</h1>
        <span className="rounded-full border border-[var(--sline)] bg-[var(--scard)] px-3.5 py-1.5 text-xs font-bold">
          {ranking.mine} pts este mes
        </span>
      </div>

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
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">
            Micro-retos de la semana
          </h2>
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
            {hitos.map((hito) => {
              const done = hito.status === "cumplido";
              return (
                <div
                  key={hito.id}
                  className={
                    done
                      ? "rounded-2xl border border-amber-500/40 bg-[var(--scard)] px-3 py-4 text-center"
                      : "rounded-2xl border border-[var(--sline)] bg-[var(--scard)] px-3 py-4 text-center opacity-50 grayscale"
                  }
                >
                  <span className="text-2xl">{hito.medal?.emoji ?? "🏅"}</span>
                  <p className="mt-1.5 font-heading text-[11px] font-bold leading-tight">{hito.title}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--sdim)]">{done ? "conseguido" : "bloqueado"}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
