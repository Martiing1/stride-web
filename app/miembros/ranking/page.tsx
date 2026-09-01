import clsx from "clsx";
import { getCurrentMember, getCommunityStaff } from "@/lib/member-auth";
import { getMonthlyRanking, getPointsWeights } from "@/lib/community";
import { todayInChile } from "@/lib/membership";
import { PointsAdminPanel } from "@/components/community/PointsAdminPanel";

export const dynamic = "force-dynamic";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function initialsOf(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

/** Ranking mensual por puntos, con entrada animada del podio y las filas. */
export default async function RankingPage() {
  const [member, staff] = await Promise.all([getCurrentMember(), getCommunityStaff()]);
  const [{ rows, mine }, weights] = await Promise.all([
    getMonthlyRanking(member?.id ?? "00000000-0000-0000-0000-000000000000"),
    getPointsWeights(),
  ]);

  const today = todayInChile();
  const [year, month, day] = today.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const resetIn = daysInMonth - day + 1;

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3, 10);
  const myIndex = rows.findIndex((row) => row.is_me);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-bold">Ranking · {MONTHS[month - 1]}</h1>
        <span className="rounded-full border border-[var(--sline)] bg-[var(--scard)] px-3.5 py-1.5 text-xs font-semibold text-[var(--smut)]">
          se reinicia en {resetIn} {resetIn === 1 ? "día" : "días"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--sline2)] p-10 text-center">
          <p className="font-heading font-bold">El mes parte de cero</p>
          <p className="mt-1 text-sm text-[var(--smut)]">
            Publica, marca tus hábitos y aparece en el próximo Social Run para abrir la tabla.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--sline)] bg-[var(--scard)]">
          {/* Podio con entrada animada */}
          <div className="flex items-end gap-2.5 px-4 pb-4 pt-6">
            {[1, 0, 2].map((position, column) => {
              const row = podium[position];
              if (!row) return <div key={position} className="flex-1" />;
              const isFirst = position === 0;
              return (
                <div
                  key={row.member_id}
                  className="m-rowin flex-1 text-center"
                  style={{ animationDelay: `${150 + column * 130}ms` }}
                >
                  {isFirst && <span className="mb-1 block text-xl">👑</span>}
                  <div
                    className={clsx(
                      "mx-auto flex items-center justify-center rounded-full border-2 font-heading font-bold text-white",
                      isFirst
                        ? "h-[72px] w-[72px] border-amber-500 text-lg shadow-[0_0_30px_rgba(245,158,11,.25)]"
                        : "h-14 w-14 border-[var(--sline2)] text-sm",
                      "bg-gradient-to-br from-stride-cyan/20 to-stride-accent/40"
                    )}
                  >
                    {initialsOf(row.full_name)}
                  </div>
                  <p className="mt-2 truncate font-heading text-xs font-bold">
                    {row.is_me ? "Tú" : row.full_name.split(" ")[0]}
                  </p>
                  <p className="text-[11px] font-bold text-stride-accent tabular-nums">{row.points} pts</p>
                  <div
                    className={clsx(
                      "mx-auto mt-2 rounded-t-lg",
                      isFirst ? "h-11 bg-gradient-to-b from-amber-500/20 to-[var(--shover)]" : position === 1 ? "h-7 bg-[var(--shover)]" : "h-5 bg-[var(--shover)]"
                    )}
                  />
                </div>
              );
            })}
          </div>

          {rest.map((row, index) => (
            <div
              key={row.member_id}
              className={clsx(
                "m-rowin flex items-center gap-3 border-t border-[var(--sline)] px-4 py-3",
                row.is_me && "border-l-2 border-l-stride-accent bg-[var(--ssoft)]"
              )}
              style={{ animationDelay: `${480 + index * 70}ms` }}
            >
              <span className="w-6 text-center font-heading text-sm font-bold text-[var(--sdim)]">{index + 4}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--shover)] font-heading text-xs font-bold">
                {initialsOf(row.full_name)}
              </span>
              <span className="min-w-0 truncate font-heading text-sm font-semibold">
                {row.is_me ? `Tú · ${row.full_name.split(" ")[0]}` : row.full_name}
              </span>
              <span className="ml-auto font-heading text-sm font-bold text-stride-accent tabular-nums">
                {row.points} pts
              </span>
            </div>
          ))}

          {myIndex >= 10 && (
            <div className="flex items-center gap-3 border-t border-[var(--sline)] border-l-2 border-l-stride-accent bg-[var(--ssoft)] px-4 py-3">
              <span className="w-6 text-center font-heading text-sm font-bold text-[var(--sdim)]">{myIndex + 1}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--shover)] font-heading text-xs font-bold">
                {initialsOf(rows[myIndex].full_name)}
              </span>
              <span className="min-w-0 truncate font-heading text-sm font-semibold">Tú · {rows[myIndex].full_name.split(" ")[0]}</span>
              <span className="ml-auto font-heading text-sm font-bold text-stride-accent tabular-nums">{mine} pts</span>
            </div>
          )}
        </div>
      )}

      {staff && <PointsAdminPanel initial={weights} />}

      <div className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-4 text-xs leading-relaxed text-[var(--smut)]">
        El <b className="text-[var(--stext)]">Nº1 del mes</b> gana premio + medalla automática; la tabla parte
        de cero cada mes. Puntos: publicar <b className="text-[var(--stext)]">{weights.post}</b> · comentar{" "}
        <b className="text-[var(--stext)]">{weights.comment}</b> · like recibido{" "}
        <b className="text-[var(--stext)]">{weights.like_received}</b> · Social Run{" "}
        <b className="text-[var(--stext)]">{weights.social_run}</b> · sesión online{" "}
        <b className="text-[var(--stext)]">{weights.sesion_online}</b> · hábitos del día{" "}
        <b className="text-[var(--stext)]">{weights.habitos_dia}</b> · reto del mes{" "}
        <b className="text-[var(--stext)]">{weights.reto_mes}</b> · micro-reto{" "}
        <b className="text-[var(--stext)]">{weights.micro_reto}</b>. Se premia la constancia, nunca la velocidad.
      </div>
    </div>
  );
}
