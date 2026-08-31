"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  AlertOctagon, Ban, BookLock, Check, ClipboardCheck, Loader2, MessageSquare, Plus, Send, ShieldAlert, X,
} from "lucide-react";
import {
  annulIncumplimiento, closeImprovementPlan, createImprovementPlan, notifyIncumplimiento,
  registerIncumplimiento, resolveIncumplimiento, submitDescargos,
} from "@/app/admin/incumplimientos/actions";
import type { TeamMember } from "@/lib/types";

export interface IncumplimientoRow {
  id: string;
  team_member_id: string;
  subject: string;
  occurred_on: string;
  evidence: string | null;
  notified_at: string | null;
  member_response: string | null;
  remediation_due: string | null;
  remediation_result: string | null;
  classification: "sin_calificar" | "subsanado" | "leve_efectivo" | "grave_directo";
  measures: string | null;
  status: "registrado" | "notificado" | "con_descargos" | "cerrado" | "anulado";
}

export interface PlanRow {
  id: string;
  team_member_id: string;
  started_on: string;
  due_on: string;
  deficiencies: string;
  outputs: string;
  result: "en_curso" | "cumplido" | "incumplido";
}

const CLASS_STYLE: Record<IncumplimientoRow["classification"], { label: string; cls: string }> = {
  sin_calificar: { label: "Sin calificar", cls: "bg-white/10 text-white/60" },
  subsanado: { label: "Subsanado", cls: "bg-emerald-500/15 text-emerald-400" },
  leve_efectivo: { label: "Leve efectivo", cls: "bg-stride-amber/15 text-stride-amber" },
  grave_directo: { label: "Grave directo", cls: "bg-red-500/15 text-red-400" },
};

const fecha = (v: string | null) => (v ? v.slice(0, 10).split("-").reverse().join("/") : "—");

/**
 * Libro de Incumplimientos (Pacto de Socios, capítulo 10). Un socio registra,
 * notifica, recibe descargos y califica; el involucrado ve lo suyo y responde.
 */
export function IncumplimientosBook({
  rows,
  plans,
  team,
  isSocio,
  currentMemberId,
}: {
  rows: IncumplimientoRow[];
  plans: PlanRow[];
  team: TeamMember[];
  isSocio: boolean;
  currentMemberId: string;
}) {
  const [creating, setCreating] = useState(false);
  const [planFor, setPlanFor] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nameOf = (id: string) => {
    const p = team.find((t) => t.id === id);
    return p ? (p.nickname ?? p.full_name) : "—";
  };

  function run(action: (f: FormData) => Promise<{ ok: boolean; error?: string }>, form: FormData, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action(form);
      if (res.ok) after?.();
      else setError(res.error ?? "No se pudo completar.");
    });
  }

  function simple(action: (f: FormData) => Promise<{ ok: boolean; error?: string }>, id: string) {
    const form = new FormData();
    form.set("id", id);
    run(action, form);
  }

  // Acumulación del 10.3: tres leves efectivos en seis meses.
  const sixMonthsAgo = new Date(Date.now() - 182 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const levesPorPersona = new Map<string, number>();
  for (const r of rows) {
    if (r.classification === "leve_efectivo" && r.status !== "anulado" && r.occurred_on >= sixMonthsAgo) {
      levesPorPersona.set(r.team_member_id, (levesPorPersona.get(r.team_member_id) ?? 0) + 1);
    }
  }
  const relevantes = [...levesPorPersona.entries()].filter(([, n]) => n >= 3);

  return (
    <div className="space-y-6">
      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      {/* Alertas de acumulación */}
      {isSocio && relevantes.map(([memberId, n]) => {
        const tienePlan = plans.some((p) => p.team_member_id === memberId && p.result === "en_curso");
        return (
          <div key={memberId} className="card border-stride-amber/40 bg-stride-amber/5">
            <p className="flex items-center gap-2 font-heading font-bold text-stride-amber">
              <AlertOctagon className="h-4 w-4" /> Incumplimiento Relevante — {nameOf(memberId)}
            </p>
            <p className="mt-1 text-sm text-white/60">
              {n} incumplimientos leves efectivos en los últimos 6 meses. El pacto (10.3) obliga a
              activar un Plan de Mejora de 30 días.
            </p>
            {!tienePlan && (
              <button type="button" onClick={() => setPlanFor(memberId)} className="btn-primary mt-3 px-5 py-2 text-sm">
                <ClipboardCheck className="h-4 w-4" /> Abrir Plan de Mejora
              </button>
            )}
          </div>
        );
      })}

      {/* Planes de mejora vigentes */}
      {plans.filter((p) => p.result === "en_curso").map((plan) => (
        <div key={plan.id} className="card border-stride-cyan/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-heading font-bold text-white">Plan de Mejora — {nameOf(plan.team_member_id)}</p>
              <p className="text-xs text-white/40">Del {fecha(plan.started_on)} al {fecha(plan.due_on)}</p>
            </div>
            {isSocio && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(closeImprovementPlan, new FormData(e.currentTarget));
                }}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="id" value={plan.id} />
                <select name="result" className="input w-auto py-1.5 text-xs" defaultValue="cumplido">
                  <option value="cumplido" className="bg-stride-card">Cumplido</option>
                  <option value="incumplido" className="bg-stride-card">Incumplido</option>
                </select>
                <button type="submit" disabled={pending} className="btn-secondary px-3 py-1.5 text-xs">Cerrar</button>
              </form>
            )}
          </div>
          <dl className="mt-3 space-y-2 text-sm text-white/60">
            <div><dt className="text-xs uppercase tracking-wide text-white/35">A corregir</dt><dd>{plan.deficiencies}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-white/35">Outputs comprometidos</dt><dd>{plan.outputs}</dd></div>
          </dl>
        </div>
      ))}

      {planFor && isSocio && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            f.set("team_member_id", planFor);
            run(createImprovementPlan, f, () => setPlanFor(null));
          }}
          className="card space-y-4"
        >
          <h2 className="font-heading text-lg font-bold text-white">Plan de Mejora — {nameOf(planFor)}</h2>
          <div>
            <label htmlFor="deficiencies" className="label">Qué debe corregirse</label>
            <textarea id="deficiencies" name="deficiencies" required rows={2} className="input resize-y" />
          </div>
          <div>
            <label htmlFor="outputs" className="label">Outputs comprometidos y sus fechas</label>
            <textarea id="outputs" name="outputs" required rows={2} className="input resize-y" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="acceptance_criteria" className="label">Criterios de aceptación</label>
              <input id="acceptance_criteria" name="acceptance_criteria" className="input" />
            </div>
            <div>
              <label htmlFor="support" className="label">Apoyo o redistribución</label>
              <input id="support" name="support" className="input" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Crear plan (30 días)</>}
            </button>
            <button type="button" onClick={() => setPlanFor(null)} className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/60">Cancelar</button>
          </div>
        </form>
      )}

      {/* Registrar */}
      {isSocio && (creating ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(registerIncumplimiento, new FormData(e.currentTarget), () => setCreating(false));
          }}
          className="card space-y-4"
        >
          <h2 className="font-heading text-lg font-bold text-white">Registrar incumplimiento</h2>
          <p className="text-sm text-white/45">
            Registrar no significa que esté acreditado: se notifica, el involucrado tiene 5 días
            hábiles para descargos y subsanación, y recién ahí se califica.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="team_member_id" className="label">Involucra a</label>
              <select id="team_member_id" name="team_member_id" required className="input" defaultValue="">
                <option value="" className="bg-stride-card">Elige…</option>
                {team.map((t) => <option key={t.id} value={t.id} className="bg-stride-card">{t.nickname ?? t.full_name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="occurred_on" className="label">Fecha del incumplimiento</label>
              <input id="occurred_on" name="occurred_on" type="date" required className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
          <div>
            <label htmlFor="subject" className="label">Output, obligación o conducta afectada</label>
            <input id="subject" name="subject" required className="input" placeholder="Planificación del social run del 07-09, entregada fuera de plazo" />
          </div>
          <div>
            <label htmlFor="evidence" className="label">Antecedentes o respaldo</label>
            <textarea id="evidence" name="evidence" rows={2} className="input resize-y" placeholder="Capturas, mensajes, quién lo constató…" />
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70">
            <input type="checkbox" name="grave_directo" value="si" className="h-4 w-4 accent-[#7C3AED]" />
            <ShieldAlert className="h-3.5 w-3.5 text-red-400" /> Incumplimiento grave directo (10.6, sin acumulación previa)
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Registrar</>}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/60">Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Registrar incumplimiento
        </button>
      ))}

      {/* Registros */}
      {rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <BookLock className="h-10 w-10 text-white/25" />
          <p className="text-sm text-white/50">El libro está vacío. Ojalá siga así.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const mine = row.team_member_id === currentMemberId;
            const cls = CLASS_STYLE[row.classification];
            return (
              <li key={row.id} className={`card space-y-3 ${row.status === "anulado" ? "opacity-50" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{row.subject}</p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {nameOf(row.team_member_id)}{mine && " · tú"} · ocurrió el {fecha(row.occurred_on)}
                      {row.notified_at && ` · notificado el ${fecha(row.notified_at)}`}
                      {row.remediation_due && row.status !== "cerrado" && ` · plazo hasta ${fecha(row.remediation_due)}`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${cls.cls}`}>{cls.label}</span>
                </div>

                {row.evidence && <p className="rounded-xl bg-white/[0.03] p-3 text-sm text-white/55">{row.evidence}</p>}
                {row.member_response && (
                  <div className="rounded-xl border border-stride-cyan/20 bg-stride-cyan/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stride-cyan">Descargos</p>
                    <p className="mt-1 text-sm text-white/70">{row.member_response}</p>
                  </div>
                )}
                {row.remediation_result && <p className="text-sm text-white/55"><span className="text-white/35">Subsanación:</span> {row.remediation_result}</p>}
                {row.measures && <p className="text-sm text-white/55"><span className="text-white/35">Medidas:</span> {row.measures}</p>}

                {/* Descargos del involucrado */}
                {mine && row.status !== "cerrado" && row.status !== "anulado" && !row.member_response && (
                  answering === row.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(submitDescargos, new FormData(e.currentTarget), () => setAnswering(null));
                      }}
                      className="space-y-2 border-t border-white/5 pt-3"
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <label htmlFor={`resp-${row.id}`} className="label">Tus descargos</label>
                      <textarea id={`resp-${row.id}`} name="member_response" required rows={3} className="input resize-y text-sm" placeholder="Tu versión de los hechos, causa no imputable, o cómo lo subsanaste." />
                      <button type="submit" disabled={pending} className="btn-primary px-4 py-2 text-sm">
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Presentar</>}
                      </button>
                    </form>
                  ) : (
                    <button type="button" onClick={() => setAnswering(row.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:text-white">
                      <MessageSquare className="h-3.5 w-3.5" /> Presentar descargos
                    </button>
                  )
                )}

                {/* Acciones del socio */}
                {isSocio && row.status !== "anulado" && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                    {!row.notified_at && (
                      <button type="button" onClick={() => simple(notifyIncumplimiento, row.id)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white">
                        <Send className="h-3.5 w-3.5" /> Notificar (abre 5 días hábiles)
                      </button>
                    )}
                    {row.status !== "cerrado" && (
                      <button type="button" onClick={() => setResolving(resolving === row.id ? null : row.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white">
                        <ClipboardCheck className="h-3.5 w-3.5" /> Calificar y cerrar
                      </button>
                    )}
                    <button type="button" onClick={() => { if (window.confirm("¿Anular este registro?")) simple(annulIncumplimiento, row.id); }} disabled={pending} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/30 hover:border-red-400/40 hover:text-red-300">
                      <Ban className="h-3.5 w-3.5" /> Anular
                    </button>
                  </div>
                )}

                {resolving === row.id && isSocio && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(resolveIncumplimiento, new FormData(e.currentTarget), () => setResolving(null));
                    }}
                    className="space-y-3 rounded-xl bg-white/[0.03] p-4"
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <div>
                      <label htmlFor={`class-${row.id}`} className="label">Calificación final</label>
                      <select id={`class-${row.id}`} name="classification" className="input" defaultValue="subsanado">
                        <option value="subsanado" className="bg-stride-card">Subsanado (queda como antecedente, no acumula)</option>
                        <option value="leve_efectivo" className="bg-stride-card">Leve efectivo (acumula para los 6 meses)</option>
                        <option value="grave_directo" className="bg-stride-card">Grave directo</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`rem-${row.id}`} className="label">Resultado de la subsanación</label>
                      <input id={`rem-${row.id}`} name="remediation_result" className="input" />
                    </div>
                    <div>
                      <label htmlFor={`med-${row.id}`} className="label">Medidas adoptadas</label>
                      <input id={`med-${row.id}`} name="measures" className="input" />
                    </div>
                    <button type="submit" disabled={pending} className="btn-primary px-4 py-2 text-sm">
                      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Cerrar registro</>}
                    </button>
                  </form>
                )}

                {row.status === "anulado" && <p className="text-xs text-white/30">Registro anulado.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
