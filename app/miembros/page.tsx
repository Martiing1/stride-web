import Link from "next/link";
import { CalendarDays, Flame, Trophy } from "lucide-react";
import { getCurrentMember, getCommunityStaff } from "@/lib/member-auth";
import {
  getChallenges,
  getFeed,
  getHabitsToday,
  getMemberEvents,
  getMonthlyRanking,
} from "@/lib/community";
import { formatDateCL } from "@/lib/membership";
import { HabitsWidget } from "@/components/community/HabitsWidget";
import { Composer } from "@/components/community/Composer";
import { StaffComposer } from "@/components/community/StaffComposer";
import { FeedClient } from "@/components/community/FeedClient";

export const dynamic = "force-dynamic";

/**
 * Blog: el inicio de la comunidad. En escritorio, columna principal + panel
 * lateral (racha, próximos eventos, ranking) al estilo Skool.
 */
export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; reto?: string }>;
}) {
  const [member, staff] = await Promise.all([getCurrentMember(), getCommunityStaff()]);
  const { q, reto } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const memberId = member?.id ?? null;

  const [habits, feedRaw, events, ranking, challenges] = await Promise.all([
    member ? getHabitsToday(member.id) : Promise.resolve(null),
    getFeed(memberId, "all"),
    getMemberEvents(memberId),
    getMonthlyRanking(memberId ?? "sin-miembro"),
    member ? getChallenges(member.id) : Promise.resolve([]),
  ]);

  const mentionables = challenges
    .filter((challenge) => challenge.status !== "cumplido" && challenge.period !== "hito")
    .map((challenge) => ({ id: challenge.id, title: challenge.title, criterio: challenge.criterio }));

  const feed = query
    ? feedRaw.filter(
        (post) =>
          post.body.toLowerCase().includes(query) ||
          (post.title ?? "").toLowerCase().includes(query) ||
          post.author_name.toLowerCase().includes(query)
      )
    : feedRaw;

  const initials = (member?.full_name ?? staff?.full_name ?? "S")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

  const upcoming = events.slice(0, 3);
  const top3 = ranking.rows.slice(0, 3);
  const myPos = ranking.rows.findIndex((row) => row.is_me) + 1;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
      <div className="space-y-4">
        {staff && <StaffComposer />}
        {habits && <HabitsWidget initial={habits} />}
        {member && <Composer initials={initials} challenges={mentionables} initialChallengeId={reto ?? null} />}
        {query && (
          <p className="text-xs text-[var(--smut)]">
            Resultados para «{q}» ·{" "}
            <Link href="/miembros" className="font-semibold text-stride-accent">
              limpiar
            </Link>
          </p>
        )}
        <FeedClient
          posts={feed}
          emptyHint={query ? "Prueba con otra palabra." : "Comparte tu primer entrenamiento y parte la conversación."}
          adminView={Boolean(staff)}
          canLike={Boolean(member)}
        />
      </div>

      {/* Panel lateral (solo escritorio) */}
      <aside className="sticky top-[118px] hidden space-y-4 lg:block">
        {habits && (
          <div className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-4">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">
              <Flame className="h-3.5 w-3.5 text-stride-accent" /> Tu racha
            </p>
            <p className="wordmark mt-2 font-heading text-4xl font-extrabold leading-none">
              {habits.streak} {habits.streak === 1 ? "día" : "días"}
            </p>
            <p className="mt-1 text-xs text-[var(--smut)]">
              {habits.all_done ? "Hábitos de hoy completos." : "Marca tus hábitos para no cortarla."}
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">
            <CalendarDays className="h-3.5 w-3.5 text-stride-accent" /> Próximos encuentros
          </p>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--smut)]">Pronto fijamos la próxima fecha.</p>
          ) : (
            <ul className="mt-2.5 space-y-2.5">
              {upcoming.map((event) => (
                <li key={event.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[var(--scard2)] text-sm">
                    {event.is_online ? "🎥" : "🏃"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-snug">{event.title}</span>
                    <span className="block text-xs text-[var(--sdim)]">
                      {formatDateCL(event.event_date)}
                      {event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/miembros/calendario" className="mt-3 block text-xs font-semibold text-stride-accent">
            Ver calendario →
          </Link>
        </div>

        <div className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">
            <Trophy className="h-3.5 w-3.5 text-stride-accent" /> Ranking del mes
          </p>
          {top3.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--smut)]">El mes parte de cero. Sé el primero en sumar.</p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {top3.map((row, index) => (
                <li key={row.member_id} className="flex items-center gap-2.5 text-sm">
                  <span className="w-4 text-center font-heading text-xs font-bold text-[var(--sdim)]">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {row.is_me ? "Tú" : row.full_name.split(" ")[0]}
                  </span>
                  <span className="font-heading text-xs font-bold text-stride-accent tabular-nums">{row.points} pts</span>
                </li>
              ))}
            </ul>
          )}
          {myPos > 3 && <p className="mt-2 text-xs text-[var(--sdim)]">Tú vas Nº{myPos} · {ranking.mine} pts</p>}
          <Link href="/miembros/ranking" className="mt-3 block text-xs font-semibold text-stride-accent">
            Ver ranking →
          </Link>
        </div>
      </aside>
    </div>
  );
}
