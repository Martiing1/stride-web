"use client";

import { compressImage } from "@/lib/image-client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Camera, ImagePlus, Target, X } from "lucide-react";
import clsx from "clsx";
import { createPost } from "@/app/miembros/community-actions";

const CHANNELS = [
  { value: "general", label: "General" },
  { value: "logros", label: "Logros" },
  { value: "presentacion", label: "Presentación" },
] as const;

const MAX_PHOTOS = 5;

export interface MentionableChallenge {
  id: string;
  title: string;
  criterio: "asistencia" | "cantidad" | "evidencia";
}

/**
 * Compositor del blog. Soporta mencionar un reto (@reto): al publicar,
 * el avance se registra desde el blog — con la foto como evidencia si el
 * reto la pide.
 */
export function Composer({
  initials,
  challenges = [],
  initialChallengeId = null,
}: {
  initials: string;
  challenges?: MentionableChallenge[];
  initialChallengeId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["value"]>("general");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [maxHit, setMaxHit] = useState(false);
  const [reto, setReto] = useState<MentionableChallenge | null>(null);
  const [retoOpen, setRetoOpen] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [wow, setWow] = useState<null | { title: string; points: number; medal: { name: string; rarity: string; emoji: string } | null }>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // Llegada desde Retos → "Publicar en el blog": abre prellenado.
  useEffect(() => {
    if (!initialChallengeId) return;
    const found = challenges.find((c) => c.id === initialChallengeId);
    if (!found) return;
    setReto(found);
    setOpen(true);
    setBody((current) => current || `¡Me sumo al reto «${found.title}»! `);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChallengeId]);

  const compress = (file: File) => compressImage(file, { maxSide: 1600, quality: 0.82 });

  const pickFiles = async (list: FileList | null) => {
    if (!list) return;
    const incoming = await Promise.all(Array.from(list).map(compress));
    setFiles((prev) => {
      const next = [...prev, ...incoming];
      setMaxHit(next.length >= MAX_PHOTOS);
      return next.slice(0, MAX_PHOTOS);
    });
  };

  const publish = () => {
    if (!body.trim()) {
      setError("Escribe algo primero.");
      return;
    }
    setError(null);
    setInfo(null);
    const formData = new FormData();
    formData.set("body", body);
    formData.set("channel", channel);
    if (reto) formData.set("challengeId", reto.id);
    for (const file of files) formData.append("photos", file);
    startTransition(async () => {
      const result = await createPost(formData);
      if (!result.ok) {
        setError(result.error ?? "No pudimos publicar.");
        return;
      }
      setBody("");
      setFiles([]);
      setReto(null);
      setMaxHit(false);
      if (result.completed) setWow(result.completed);
      else setOpen(false);
      if (result.info) setInfo(result.info);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-full border border-[var(--sline)] bg-[var(--scard)] px-3 py-2.5 text-left transition hover:border-[var(--sline2)]"
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-stride-cyan/25 to-stride-accent/40 font-heading text-[11px] font-bold text-white">
            {initials}
          </span>
          <span className="flex-1 text-sm text-[var(--sdim)]">Escribe algo…</span>
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--shover)] text-stride-accent">
            <Camera className="h-4 w-4" />
          </span>
        </button>
        {info && <p className="mt-2 px-2 text-xs font-semibold text-emerald-500">{info}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-bold">Nueva publicación</h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--sdim)] transition hover:bg-[var(--shover)] hover:text-[var(--stext)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (e.target.value.endsWith("@") && challenges.length > 0) setRetoOpen(true);
          }}
          placeholder="¿Qué quieres compartir? Escribe @ para mencionar un reto."
          autoFocus
          maxLength={4000}
          className="mt-3 min-h-24 w-full resize-y rounded-xl border border-[var(--sline)] bg-[var(--scard2)] p-3.5 text-sm outline-none placeholder:text-[var(--sdim)] focus:border-stride-cyan"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {CHANNELS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setChannel(option.value)}
              className={clsx(
                "rounded-full border px-3.5 py-1.5 font-heading text-xs font-semibold transition",
                channel === option.value
                  ? "border-transparent bg-stride-accent text-white"
                  : "border-[var(--sline2)] text-[var(--smut)] hover:border-[var(--stext)]"
              )}
            >
              {option.label}
            </button>
          ))}

          {/* Mención de reto */}
          {challenges.length > 0 && (
            <div className="relative">
              {reto ? (
                <span className="flex items-center gap-1.5 rounded-full border border-stride-accent/40 bg-[var(--ssoft)] px-3 py-1.5 text-xs font-bold text-stride-accent">
                  <Target className="h-3.5 w-3.5" /> @{reto.title.length > 22 ? `${reto.title.slice(0, 20)}…` : reto.title}
                  <button type="button" aria-label="Quitar reto" onClick={() => setReto(null)} className="ml-0.5 hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setRetoOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full border border-dashed border-[var(--sline2)] px-3.5 py-1.5 text-xs font-semibold text-[var(--smut)] transition hover:border-[var(--stext)] hover:text-[var(--stext)]"
                >
                  <AtSign className="h-3.5 w-3.5" /> Reto
                </button>
              )}
              {retoOpen && (
                <div className="absolute left-0 top-9 z-30 w-72 overflow-hidden rounded-xl border border-[var(--sline)] bg-[var(--scard)] shadow-xl shadow-black/30">
                  {challenges.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setReto(option);
                        setRetoOpen(false);
                        setBody((current) => (current.endsWith("@") ? current.slice(0, -1) : current));
                      }}
                      className="flex w-full items-center gap-2 border-b border-[var(--sline)] px-3.5 py-2.5 text-left text-sm font-semibold transition last:border-b-0 hover:bg-[var(--shover)]"
                    >
                      <Target className="h-3.5 w-3.5 flex-none text-stride-accent" />
                      <span className="min-w-0 flex-1 truncate">{option.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {reto && (
          <p className="mt-2 text-[11px] text-[var(--sdim)]">
            {reto.criterio === "cantidad"
              ? "Al publicar se registra +1 en este reto."
              : reto.criterio === "evidencia"
                ? "Tu foto quedará como evidencia del reto (adjunta una)."
                : "Este reto se valida con tu asistencia; el post solo lo comparte."}
          </p>
        )}

        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 rounded-full border border-[var(--sline2)] bg-[var(--scard2)] px-3 py-1.5 text-xs"
              >
                <ImagePlus className="h-3.5 w-3.5 text-stride-accent" />
                {file.name.length > 18 ? `${file.name.slice(0, 15)}…` : file.name}
                <button
                  type="button"
                  aria-label="Quitar foto"
                  onClick={() => {
                    setFiles((prev) => prev.filter((_, i) => i !== index));
                    setMaxHit(false);
                  }}
                  className="text-[var(--sdim)] hover:text-[var(--stext)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-3.5 flex items-center gap-2">
          <button type="button" onClick={publish} disabled={pending} className="btn-primary flex-1 px-4 py-2.5 text-sm disabled:opacity-60">
            {pending ? "Publicando…" : "Publicar"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => pickFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => (files.length >= MAX_PHOTOS ? setMaxHit(true) : fileRef.current?.click())}
            className={clsx(
              "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
              files.length >= MAX_PHOTOS
                ? "cursor-not-allowed border-[var(--sline)] text-[var(--sdim)]"
                : "border-[var(--sline2)] text-[var(--smut)] hover:bg-[var(--shover)]"
            )}
          >
            <ImagePlus className="h-4 w-4" /> Foto
          </button>
        </div>
        {maxHit && files.length >= MAX_PHOTOS && (
          <p className="mt-2.5 text-xs font-semibold text-amber-500">Solo hasta 5 fotos por publicación.</p>
        )}
        {error && <p className="mt-2 text-xs font-semibold text-red-400">{error}</p>}
      </div>

      {/* WOW: el reto se completó publicando */}
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
            <p className="mt-2 text-sm text-white/70">+{wow.points} pts · y tu post ya está en el blog</p>
            <button
              type="button"
              onClick={() => {
                setWow(null);
                setOpen(false);
              }}
              className="btn-primary mt-6 w-full px-6 py-3 text-sm"
            >
              ¡Vamos!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
