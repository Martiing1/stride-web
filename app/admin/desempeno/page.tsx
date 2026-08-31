import Link from "next/link";
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardCheck, Footprints, ShieldAlert } from "lucide-react";
import { requireTeamMember, ROLE_LABELS } from "@/lib/auth";
import { getTeamPerformance } from "@/lib/performance";

export const dynamic = "force-dynamic";

export const metadata = { title: "Desempeño del equipo" };

// Paleta validada del sistema de visualización (modo oscuro).
const C_TAREAS = "#3987e5";
const C_PUNTUAL = "#199e70";
const C_CUMPLE = "#c98500";

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

/** Barra fina con su valor al lado; el color identifica la métrica, no el rango. */
function Bar({ value, color, label }: { value: number | null; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2" title={`${label}: ${pct(value)}`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${(value ?? 0) * 100}%`, background: color }} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs text-white/55">{pct(value)}</span>
    </div>
  );
}

export default async function DesempenoPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  await requireTeamMember(["socio"]);
  const { dias } = await searchParams;
  const days = dias === "30" || dias === "180" ? Number(dias) : 90;
  const { rows } = await getTeamPerformance(days);

  // Se mide a todo el equipo, socios incluidos: el pacto los somete al mismo régimen.
  const staff = rows;
  const withData = staff.filter((r) => r.tasksTotal > 0 || r.evaluationsDue > 0);
  const avgScore = withData.length
    ? Math.round(withData.reduce((s, r) => s + (r.score ?? 0), 0) / withData.length)
    : null;
  const totalOverdue = staff.reduce((s, r) => s + r.tasksOverdue, 0);
  const pendingEvals = staff.reduce((s, r) => s + Math.max(0, r.evaluationsDue - r.evaluationsSent), 0);
  const ranked = [...staff].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
            <BarChart3 className="h-3.5 w-3.5" /> Desempeño
          </p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">Cómo va el equipo</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
            Se calcula solo, con lo que ya hacen en el sistema: tareas cerradas y a tiempo,
            asistencia a los social runs y evaluaciones entregadas.
          </p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <div>
            <label htmlFor="dias" className="label">Periodo</label>
            <select id="dias" name="dias" defaultValue={String(days)} className="input w-auto py-2 text-sm">
              <option value="30" className="bg-stride-card">Últimos 30 días</option>
              <option value="90" className="bg-stride-card">Últimos 90 días</option>
              <option value="180" className="bg-stride-card">Últimos 180 días</option>
            </select>
          </div>
          <button type="submit" className="btn-secondary px-4 py-2 text-sm">Ver</button>
        </form>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Nota promedio del equipo", value: avgScore !== null ? `${avgScore}` : "—", icon: CheckCircle2 },
          { label: "Tareas vencidas sin cerrar", value: String(totalOverdue), icon: AlertTriangle },
          { label: "Evaluaciones sin entregar", value: String(pendingEvals), icon: ClipboardCheck },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card">
            <Icon className="h-5 w-5 text-white/30" />
            <p className="mt-3 font-heading text-3xl font-extrabold text-white">{value}</p>
            <p className="mt-1 text-sm text-white/45">{label}</p>
          </div>
        ))}
      </section>

      <section className="card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-white">Por persona</h2>
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/55">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_TAREAS }} /> Tareas cerradas</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_PUNTUAL }} /> A tiempo</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_CUMPLE }} /> Evaluaciones</span>
          </div>
        </div>

        {ranked.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/40">No hay líderes ni monitores activos todavía.</p>
        ) : (
          <ul className="space-y-5">
            {ranked.map((row) => (
              <li key={row.member.id} className="grid gap-3 sm:grid-cols-[190px_1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{row.member.nickname ?? row.member.full_name}</p>
                  <p className="text-xs text-white/35">
                    {ROLE_LABELS[row.member.role]}
                    {row.rolesTaken > 0 && ` · ${row.rolesTaken} rol${row.rolesTaken === 1 ? "" : "es"} en eventos`}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Bar value={row.tasksTotal ? row.tasksDone / row.tasksTotal : null} color={C_TAREAS} label="Tareas cerradas" />
                  <Bar value={row.onTimeRate} color={C_PUNTUAL} label="A tiempo" />
                  <Bar value={row.complianceRate} color={C_CUMPLE} label="Evaluaciones entregadas" />
                  <p className="pt-0.5 text-[11px] text-white/35">
                    {row.tasksDone}/{row.tasksTotal} tareas
                    {row.tasksOverdue > 0 && <span className="text-red-400"> · {row.tasksOverdue} vencida{row.tasksOverdue === 1 ? "" : "s"}</span>}
                    {row.evaluationsDue > 0 && ` · ${row.evaluationsSent}/${row.evaluationsDue} evaluaciones`}
                    <span className="inline-flex items-center gap-1"> · <Footprints className="h-3 w-3" /> {row.eventsAttended} asistencias</span>
                    {row.warnings > 0 && (
                      <Link href={`/admin/amonestaciones?persona=${row.member.id}`} className="ml-1 inline-flex items-center gap-1 text-stride-amber hover:underline">
                        <ShieldAlert className="h-3 w-3" /> {row.warnings} amonestación{row.warnings === 1 ? "" : "es"}
                      </Link>
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <p className={`font-heading text-2xl font-extrabold ${row.score === null ? "text-white/25" : row.score >= 70 ? "text-emerald-400" : row.score >= 50 ? "text-stride-amber" : "text-red-400"}`}>
                    {row.score ?? "—"}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-white/30">Nota</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="border-t border-white/5 pt-4 text-xs leading-relaxed text-white/35">
          La nota pondera 50% tareas cerradas, 30% puntualidad y 20% evaluaciones al día, y
          descuenta por amonestaciones. Un guion significa que aún no hay datos suficientes —
          no es un cero.
        </p>
      </section>
    </div>
  );
}
