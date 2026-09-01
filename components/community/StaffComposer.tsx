"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Megaphone, Pin, X, Youtube } from "lucide-react";
import clsx from "clsx";
import { staffCreatePost } from "@/app/miembros/community-actions";

const CHANNELS = [
  { value: "general", label: "General" },
  { value: "logros", label: "Logros" },
  { value: "presentacion", label: "Presentación" },
] as const;

/** Compositor del STAFF: publica como STRIDE, con fijado y video. */
export function StaffComposer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["value"]>("general");
  const [pinned, setPinned] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const publish = () => {
    if (!body.trim()) return setError("Escribe el comunicado primero.");
    setError(null);
    const formData = new FormData();
    formData.set("title", title);
    formData.set("body", body);
    formData.set("channel", channel);
    formData.set("pinned", String(pinned));
    formData.set("videoUrl", videoUrl);
    for (const file of files) formData.append("photos", file);
    startTransition(async () => {
      const result = await staffCreatePost(formData);
      if (!result.ok) return setError(result.error ?? "No pudimos publicar.");
      setTitle("");
      setBody("");
      setVideoUrl("");
      setFiles([]);
      setPinned(false);
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-full border border-stride-accent/40 bg-[var(--ssoft)] px-4 py-2.5 text-left transition hover:border-stride-accent"
      >
        <Megaphone className="h-4 w-4 flex-none text-stride-accent" />
        <span className="flex-1 text-sm font-semibold text-[var(--stext)]">Publicar comunicado como STRIDE…</span>
        <span className="rounded-full bg-stride-accent px-2.5 py-0.5 text-[10px] font-bold text-white">ADMIN</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-stride-accent/40 bg-[var(--scard)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-heading text-base font-bold">
          <Megaphone className="h-4 w-4 text-stride-accent" /> Comunicado del staff
        </h3>
        <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} className="text-[var(--sdim)] hover:text-[var(--stext)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título (opcional, ej: Social Run · domingo 6)"
        className="mt-3 w-full rounded-xl border border-[var(--sline)] bg-[var(--scard2)] px-3.5 py-2.5 text-sm font-semibold outline-none placeholder:text-[var(--sdim)] focus:border-stride-cyan"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="El mensaje para la comunidad…"
        autoFocus
        className="mt-2.5 min-h-24 w-full resize-y rounded-xl border border-[var(--sline)] bg-[var(--scard2)] p-3.5 text-sm outline-none placeholder:text-[var(--sdim)] focus:border-stride-cyan"
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
        <button
          type="button"
          onClick={() => setPinned((v) => !v)}
          className={clsx(
            "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-heading text-xs font-semibold transition",
            pinned
              ? "border-transparent bg-stride-cyan/20 text-stride-cyan"
              : "border-dashed border-[var(--sline2)] text-[var(--smut)] hover:border-[var(--stext)]"
          )}
        >
          <Pin className="h-3.5 w-3.5" /> {pinned ? "Fijado" : "Fijar"}
        </button>
      </div>
      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-[var(--sline)] bg-[var(--scard2)] px-3 py-2">
        <Youtube className="h-4 w-4 flex-none text-red-500" />
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Link de YouTube (opcional)"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--sdim)]"
        />
      </div>

      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <span key={index} className="flex items-center gap-2 rounded-full border border-[var(--sline2)] bg-[var(--scard2)] px-3 py-1.5 text-xs">
              <ImagePlus className="h-3.5 w-3.5 text-stride-accent" />
              {file.name.slice(0, 16)}
              <button type="button" aria-label="Quitar" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))} className="text-[var(--sdim)] hover:text-[var(--stext)]">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3.5 flex items-center gap-2">
        <button type="button" onClick={publish} disabled={pending} className="btn-primary flex-1 px-4 py-2.5 text-sm disabled:opacity-60">
          {pending ? "Publicando…" : pinned ? "Publicar y fijar" : "Publicar como STRIDE"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => e.target.files && setFiles((prev) => [...prev, ...Array.from(e.target.files!)].slice(0, 4))}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-10 items-center gap-2 rounded-full border border-[var(--sline2)] px-4 text-sm font-semibold text-[var(--smut)] hover:bg-[var(--shover)]"
        >
          <ImagePlus className="h-4 w-4" /> Foto
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-400">{error}</p>}
    </div>
  );
}
