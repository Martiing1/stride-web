"use client";

import { compressImage } from "@/lib/image-client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus } from "lucide-react";
import { uploadPhysicalMedal } from "@/app/miembros/community-actions";

/**
 * "Inmortaliza" una medalla física: foto + nombre → queda en revisión hasta
 * que el staff la valida, y de ahí vive para siempre en la vitrina.
 */
export function PhysicalMedalForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!title.trim()) return setError("Ponle nombre (ej: 10K Viña 2026).");
    if (!file) return setError("Sube la foto de tu medalla.");
    setError(null);
    const formData = new FormData();
    formData.set("title", title);
    startTransition(async () => {
      formData.set("photo", await compressImage(file));
      const result = await uploadPhysicalMedal(formData);
      if (!result.ok) return setError(result.error ?? "No pudimos subirla.");
      setOpen(false);
      setTitle("");
      setFile(null);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--sline2)] px-3 py-4 text-center transition hover:border-[var(--stext)]"
      >
        <ImagePlus className="h-6 w-6 text-[var(--sdim)]" />
        <span className="font-heading text-[11px] font-bold leading-tight">Subir medalla física</span>
        <span className="text-[10px] text-[var(--sdim)]">de una carrera</span>
      </button>
    );
  }

  return (
    <div className="col-span-2 space-y-3 rounded-2xl border border-[var(--sline)] bg-[var(--scard2)] p-4 sm:col-span-3">
      <p className="font-heading text-sm font-bold">Inmortaliza tu medalla</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nombre (ej: 10K Viña 2026)"
        maxLength={80}
        className="w-full rounded-xl border border-[var(--sline2)] bg-[var(--scard)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--sdim)] focus:border-stride-cyan"
      />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--sline2)] py-2.5 text-sm font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]"
      >
        <Camera className="h-4 w-4" /> {file ? file.name.slice(0, 24) : "Elegir foto"}
      </button>
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={pending} className="btn-primary flex-1 px-4 py-2.5 text-sm disabled:opacity-60">
          {pending ? "Subiendo…" : "Enviar a revisión"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-[var(--sline2)] px-4 text-sm text-[var(--smut)] hover:bg-[var(--shover)]"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
    </div>
  );
}
