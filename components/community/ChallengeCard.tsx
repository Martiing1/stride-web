"use client";

import { compressImage } from "@/lib/image-client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, PenLine, Target, Upload, Video, X } from "lucide-react";
import clsx from "clsx";
import { createPost, reportTraining, uploadEvidence } from "@/app/miembros/community-actions";
import type { ChallengeView } from "@/lib/community";

const CONFETTI = ["#00E5FF", "#6366F1", "#7C3AED", "#F59E0B", "#ffffff", "#c4b5fd"];

export function ChallengeCard({ challenge, highlight }: { challenge: ChallengeView; highlight?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState(challenge);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFile, setReportFile] = useState<File | null>(null);
  /** Segundo paso del popup: escribir el post antes de publicarlo. */
  const [blogDraft, setBlogDraft] = useState<string | null>(null);
  const [wow, setWow] = useState<null | { title: string; points: number; medal: { name: string; rarity: string; emoji: string } | null }>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reportFileRef = useRef<HTMLInputElement>(null);
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const pct = Math.min(100, Math.round((state.count / state.goal) * 100));
  const done = state.status === "cumplido";

  const burstScreen = () => {
    if (reduced) return;
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:95;overflow:hidden";
    document.body.appendChild(host);
    for (let i = 0; i < 42; i++) {
      const piece = document.createElement("i");
      piece.style.cssText = `position:absolute;top:-16px;left:${2 + Math.random() * 96}%;width:8px;height:12px;border-radius:2px;background:${CONFETTI[i % CONFETTI.length]}`;
      host.appendChild(piece);
      piece.animate(
        [
          { transform: "translateY(0) rotate(0)", opacity: 1 },
          { transform: `translateY(${window.innerHeight * 0.85}px) rotate(${Math.random() > 0.5 ? "" : "-"}${300 + Math.random() * 420}deg)`, opacity: 0 },
        ],
        { duration: 1600 + Math.random() * 1200, delay: Math.random() * 400, easing: "cubic-bezier(.15,.6,.4,1)", fill: "forwards" }
      );
    }
    window.setTimeout(() => host.remove(), 3400);
  };

  /** Envía el +1 (con evidencia opcional desde el popup). */
  const submitReport = () => {
    if (done || pending) return;
    setError(null);
    const formData = new FormData();
    formData.set("challengeId", challenge.id);
    const evidenceFile = reportFile;
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
        burstScreen();
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
        burstScreen();
      } else {
        setState((s) =>
          s.criterio === "evidencia"
            ? { ...s, status: "en_verificacion" }
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
      setState((s) => ({ ...s, status: "en_verificacion" }));
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
                +1 entrenamiento
              </button>
            ) : state.criterio === "evidencia" ? (
              state.status === "en_verificacion" ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-500">
                  En verificación — el staff la revisa y te avisa
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    disabled={pending}
                    className="flex items-center gap-2 rounded-full border border-[var(--sline2)] px-4 py-2.5 font-heading text-xs font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)] disabled:opacity-60"
                  >
                    <Upload className="h-3.5 w-3.5" /> {pending ? "Subiendo…" : "Subir evidencia"}
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
          </div>
          {error && <p className="mt-2.5 text-xs font-semibold text-red-400">{error}</p>}
        </div>
      </div>

      {/* Popup de registro (+1 con evidencia opcional) */}
      {reportOpen && (
        <div className="fixed inset-0 z-[92] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={(e) => e.target === e.currentTarget && setReportOpen(false)}>
          <div className="m-rowin w-full max-w-sm rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-bold">Registrar entrenamiento</h3>
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

      {/* WOW */}
      {wow && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/85 p-6 text-center backdrop-blur-md">
          <div className="m-rowin max-w-xs">
            <div className="text-[88px] leading-none drop-shadow-[0_14px_30px_rgba(245,158,11,.4)]">
              {wow.medal?.emoji ?? "🏅"}
            </div>
            <h2 className="wordmark mt-4 font-heading text-2xl font-extrabold">¡RETO CUMPLIDO!</h2>
            {wow.medal && (
              <p className="mt-1 font-heading text-sm font-bold text-amber-400">
                Medalla {wow.medal.name} · {wow.medal.rarity === "oro" ? "Oro" : wow.medal.rarity}
              </p>
            )}
            <p className="mt-2 text-sm text-white/70">
              +{wow.points} pts{wow.medal ? " · ya brilla en tu vitrina" : ""}
            </p>
            <button type="button" onClick={() => setWow(null)} className="btn-primary mt-6 w-full px-6 py-3 text-sm">
              ¡Vamos!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
