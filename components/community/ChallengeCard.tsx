"use client";

import { compressImage } from "@/lib/image-client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, PenLine, Target, Upload, Video, X } from "lucide-react";
import clsx from "clsx";
import { createPost, reportTraining, uploadEvidence } from "@/app/miembros/community-actions";
import { ShareButton } from "@/components/community/ShareCardModal";
import { ChallengeCelebration, type Completed } from "@/components/community/ChallengeCelebration";
import { RegisteredSheet } from "@/components/community/RegisteredSheet";
import { RARITY_LABEL, asRarity } from "@/components/community/MedalBadge";
import { unitLabel, type ShareCardData, type ShareStat } from "@/lib/share-card";
import type { ChallengeView } from "@/lib/community";

/** "10 sept" en hora Chile, para "en verificación desde…". */
function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" })
    .format(new Date(iso))
    .replace(".", "");
}

export function ChallengeCard({ challenge, highlight }: { challenge: ChallengeView; highlight?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState(challenge);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFile, setReportFile] = useState<File | null>(null);
  /** Segundo paso del popup: escribir el post antes de publicarlo. */
  const [blogDraft, setBlogDraft] = useState<string | null>(null);
  const [wow, setWow] = useState<Completed | null>(null);
  /** Confirmación de un registro que no cumple el reto: trae el botón grande de compartir. */
  const [logged, setLogged] = useState<{ title: string; detail: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reportFileRef = useRef<HTMLInputElement>(null);

  const pct = Math.min(100, Math.round((state.count / state.goal) * 100));
  /** Qué se registra con el "+1": lo define el reto ("avance", "foto"…). */
  const unit = state.unit?.trim() || "entrenamiento";
  const done = state.status === "cumplido";
  /** Se puede compartir cuando ya hay algo que mostrar. */
  const shareable = done || state.count > 0 || state.status === "en_verificacion";

  /**
   * Datos de la tarjeta de Instagram. Sin ritmo ni velocidad: las cifras son
   * de constancia (avance, puntos, medalla), como manda la marca.
   */
  const shareData = (): ShareCardData => {
    const stats: ShareStat[] = [];
    if (state.criterio !== "evidencia" && state.goal > 1) {
      stats.push({ label: unitLabel(state.unit), value: `${state.count}/${state.goal}` });
    }
    stats.push({ label: "Puntos", value: `+${state.points}` });
    if (done && state.medal) stats.push({ label: "Medalla", value: RARITY_LABEL[state.medal.rarity] ?? state.medal.rarity, tint: true });
    return {
      headline: done ? "Reto cumplido" : state.status === "en_verificacion" ? "Reto enviado" : "Voy avanzando",
      title: state.title,
      stats,
      medal: done ? asRarity(state.medal?.rarity) : null,
    };
  };

  /** Envía el +1 (con evidencia opcional desde el popup). */
  const submitReport = () => {
    if (done || pending) return;
    setError(null);
    const formData = new FormData();
    formData.set("challengeId", challenge.id);
    const evidenceFile = reportFile;
    const nextCount = Math.min(state.count + 1, state.goal);
    setState((s) => ({ ...s, count: Math.min(s.count + 1, s.goal) }));
    setReportOpen(false);
    setReportFile(null);
    startTransition(async () => {
      if (evidenceFile) formData.set("evidence", await compressImage(evidenceFile));
      const result = await reportTraining(formData);
      if (!result.ok) {
        setError(result.error ?? "No pudimos registrar tu avance.");
        setState(challenge);
        return;
      }
      if (result.completed) {
        setState((s) => ({ ...s, status: "cumplido" }));
        setWow(result.completed);
      } else {
        setLogged({
          title: "¡Registrado!",
          detail: `Llevas ${nextCount} de ${state.goal}${state.unit ? ` ${unitLabel(state.unit).toLowerCase()}` : ""}. Muéstralo.`,
        });
      }
      router.refresh();
    });
  };

  /**
   * Publica la evidencia en el blog. El propio post avanza el reto: createPost
   * recibe el challengeId y se encarga del +1 o de dejar la foto en revisión,
   * así la persona no tiene que hacer dos veces lo mismo.
   */
  const publishToBlog = () => {
    if (blogDraft === null || pending) return;
    const text = blogDraft.trim();
    if (!text) return setError("Escribe algo antes de publicar.");
    const file = reportFile;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("body", text);
      formData.set("channel", "logros");
      formData.set("challengeId", challenge.id);
      if (file) formData.append("photos", await compressImage(file));
      const result = await createPost(formData);
      if (!result.ok) {
        setError(result.error ?? "No pudimos publicar.");
        return;
      }
      setReportOpen(false);
      setBlogDraft(null);
      setReportFile(null);
      if (result.completed) {
        setState((s) => ({ ...s, status: "cumplido" }));
        setWow(result.completed);
      } else {
        setState((s) =>
          s.criterio === "evidencia"
            ? { ...s, status: "en_verificacion", submitted_at: new Date().toISOString() }
            : { ...s, count: Math.min(s.count + 1, s.goal) }
        );
      }
      router.refresh();
    });
  };

  const sendEvidence = (file: File | null) => {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("challengeId", challenge.id);
    startTransition(async () => {
      formData.set("evidence", await compressImage(file));
      const result = await uploadEvidence(formData);
      if (!result.ok) {
        setError(result.error ?? "No pudimos subir la evidencia.");
        return;
      }
      setState((s) => ({ ...s, status: "en_verificacion", submitted_at: new Date().toISOString() }));
      setReportOpen(false);
      setReportFile(null);
      setLogged({ title: "¡Evidencia enviada!", detail: "El equipo la revisa y te avisa. Mientras, cuéntalo." });
      router.refresh();
    });
  };

  return (
    <>
      <div className={clsx("rounded-2xl p-[1.5px]", highlight ? "gradient-surface" : "bg-[var(--sline)]")}>
        <div
          className={clsx(
            "rounded-[calc(1rem-1.5px)] p-4",
            done ? "bg-gradient-to-br from-emerald-500/10 to-[var(--scard)]" : "bg-[var(--scard)]"
          )}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[var(--scard2)] text-stride-accent">
              {state.criterio === "evidencia" ? <Video className="h-5 w-5" /> : <Target className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="font-heading text-sm font-bold leading-snug">{state.title}</p>
              {state.description && <p className="mt-0.5 text-xs text-[var(--smut)]">{state.description}</p>}
            </div>
            <div className="ml-auto flex-none text-right">
              <p className="font-heading text-sm font-bold text-stride-accent">+{state.points} pts</p>
              {state.medal && (
                <p className="text-[10px] font-semibold text-amber-500">
                  {state.medal.emoji} {state.medal.rarity === "oro" ? "Oro" : state.medal.rarity}
                </p>
              )}
            </div>
          </div>

          {state.criterio !== "evidencia" && (
            <div className="mt-3.5 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--shover)]">
                <div className="gradient-surface h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="font-heading text-xs font-bold tabular-nums">
                {state.count}/{state.goal}
              </span>
            </div>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {done ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 font-heading text-xs font-bold text-emerald-500">
                Cumplido {state.medal ? "· medalla en tu vitrina" : ""}
              </span>
            ) : state.criterio === "cantidad" ? (
              <button type="button" onClick={() => setReportOpen(true)} disabled={pending} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60">
                +1 {unit}
              </button>
            ) : state.criterio === "evidencia" ? (
              state.status === "en_verificacion" ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-500">
                  En verificación{state.submitted_at ? ` desde el ${shortDate(state.submitted_at)}` : ""} · el staff la revisa y te avisa
                </span>
              ) : (
                <>
                  {/* Rechazada: antes la tarjeta volvía a "Subir evidencia" sin decir nada. */}
                  {state.status === "rechazado" && (
                    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-400">
                      No se aprobó · inténtalo de nuevo
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    disabled={pending}
                    className="flex items-center gap-2 rounded-full border border-[var(--sline2)] px-4 py-2.5 font-heading text-xs font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)] disabled:opacity-60"
                  >
                    <Upload className="h-3.5 w-3.5" /> {pending ? "Subiendo…" : state.status === "rechazado" ? "Subir otra evidencia" : "Subir evidencia"}
                  </button>
                </>
              )
            ) : (
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-500">
                Se valida con tu asistencia
              </span>
            )}

            {/* Retos generales: compártelo y avánzalo desde el blog */}
            {!done && challenge.period === "general" && (
              <Link
                href={`/miembros?reto=${challenge.id}`}
                className="flex items-center gap-2 rounded-full border border-[var(--sline2)] px-4 py-2.5 font-heading text-xs font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]"
              >
                <PenLine className="h-3.5 w-3.5" /> Publicar en el blog
              </Link>
            )}

            {/* Afuera: la misma historia, pero para Instagram */}
            {shareable && (
              <ShareButton
                data={shareData()}
                label="Compartir"
                className={done ? "border-stride-accent/40 text-stride-accent" : undefined}
              />
            )}
          </div>
          {error && <p className="mt-2.5 text-xs font-semibold text-red-400">{error}</p>}
        </div>
      </div>

      {/* Popup de registro (+1 con evidencia opcional) */}
      {reportOpen && (
        <div className="fixed inset-0 z-[92] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && setReportOpen(false)}>
          <div className="m-rowin w-full max-w-sm rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-bold">Registrar {unit}</h3>
              <button type="button" aria-label="Cerrar" onClick={() => setReportOpen(false)} className="text-[var(--sdim)] hover:text-[var(--stext)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-sm text-[var(--smut)]">
              {blogDraft !== null
                ? "Cuéntalo como quieras. Se publica en el blog y el reto avanza solo."
                : state.criterio === "evidencia"
                  ? "Sube la foto o el video de tu evidencia. El staff la revisa y te avisa."
                  : `Suma el ${state.count + 1}º de ${state.goal}. Si quieres, adjunta una foto como evidencia — el staff la puede mirar al premiar.`}
            </p>
            <input
              ref={reportFileRef}
              type="file"
              accept="image/*,video/mp4,video/quicktime"
              hidden
              onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => reportFileRef.current?.click()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--sline2)] py-3 text-sm font-semibold text-[var(--smut)] transition hover:border-[var(--stext)] hover:text-[var(--stext)]"
            >
              <Camera className="h-4 w-4" />
              {reportFile
                ? reportFile.name.slice(0, 28)
                : state.criterio === "evidencia"
                  ? "Adjuntar evidencia"
                  : "Adjuntar evidencia (opcional)"}
            </button>

            {/* Paso 2: el mensaje del blog, editable antes de publicar. */}
            {blogDraft !== null && (
              <textarea
                value={blogDraft}
                onChange={(e) => setBlogDraft(e.target.value)}
                rows={4}
                maxLength={4000}
                autoFocus
                placeholder="Cuenta cómo te fue…"
                className="mt-3 w-full resize-none rounded-xl border border-[var(--sline2)] bg-[var(--scard2)] px-3.5 py-3 text-sm leading-relaxed text-[var(--stext)] outline-none placeholder:text-[var(--sdim)] focus:border-stride-accent"
              />
            )}
            {error && <p className="mt-3 text-xs font-semibold text-red-400">{error}</p>}

            {blogDraft === null ? (
              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={state.criterio === "evidencia" ? () => sendEvidence(reportFile) : submitReport}
                    disabled={pending || (state.criterio === "evidencia" && !reportFile)}
                    className="btn-primary flex-1 px-4 py-2.5 text-sm disabled:opacity-60"
                  >
                    {pending ? "Registrando…" : "Registrar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="rounded-full border border-[var(--sline2)] px-4 py-2 text-sm text-[var(--smut)] hover:bg-[var(--shover)]"
                  >
                    Cancelar
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setBlogDraft(`¡Avancé en «${state.title}»! `);
                  }}
                  disabled={pending}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-stride-accent/40 py-2.5 font-heading text-sm font-bold text-stride-accent transition hover:bg-stride-accent hover:text-white disabled:opacity-60"
                >
                  <PenLine className="h-3.5 w-3.5" /> Dejarlo en el blog
                </button>
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={publishToBlog} disabled={pending} className="btn-primary flex-1 px-4 py-2.5 text-sm disabled:opacity-60">
                  {pending ? "Publicando…" : "Publicar"}
                </button>
                <button
                  type="button"
                  onClick={() => setBlogDraft(null)}
                  className="rounded-full border border-[var(--sline2)] px-4 py-2 text-sm text-[var(--smut)] hover:bg-[var(--shover)]"
                >
                  Atrás
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {wow && <ChallengeCelebration completed={wow} share={shareData()} onClose={() => setWow(null)} />}
      {logged && !wow && (
        <RegisteredSheet title={logged.title} detail={logged.detail} share={shareData()} onClose={() => setLogged(null)} />
      )}
    </>
  );
}
