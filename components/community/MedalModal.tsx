"use client";

import { compressImage } from "@/lib/image-client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, X } from "lucide-react";
import clsx from "clsx";
import { saveMedalMemory } from "@/app/miembros/community-actions";
import type { VitrinaMedal } from "@/lib/community";

const RARITY_LABEL: Record<string, string> = { oro: "Oro", plata: "Plata", bronce: "Bronce" };
const RARITY_BORDER: Record<string, string> = {
  oro: "border-amber-500/40",
  plata: "border-slate-300/40",
  bronce: "border-orange-400/40",
};

/**
 * Vitrina interactiva: al tocar una medalla se abre su detalle con la nota
 * personal para "inmortalizar el momento".
 */
export function MedalGrid({ medals, children }: { medals: VitrinaMedal[]; children?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState<VitrinaMedal | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const show = (medal: VitrinaMedal) => {
    setOpen(medal);
    setNote(medal.note ?? "");
    setPhoto(null);
    setError(null);
  };

  const save = () => {
    if (!open) return;
    const formData = new FormData();
    formData.set("medalId", open.id);
    formData.set("note", note);
    startTransition(async () => {
      if (photo) formData.set("photo", await compressImage(photo));
      const result = await saveMedalMemory(formData);
      if (!result.ok) {
        setError(result.error ?? "No pudimos guardar.");
        return;
      }
      setOpen(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {medals.map((medal) => (
          <button
            key={medal.id}
            type="button"
            onClick={() => show(medal)}
            className={clsx(
              "rounded-2xl border bg-[var(--scard)] px-3 py-4 text-center transition hover:scale-[1.02]",
              medal.status === "en_revision" ? "border-dashed border-[var(--sline2)] opacity-70" : RARITY_BORDER[medal.rarity]
            )}
          >
            {medal.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={medal.photo_url} alt={medal.name} className="mx-auto h-12 w-12 rounded-full border border-[var(--sline2)] object-cover" />
            ) : (
              <span className="text-2xl">{medal.emoji}</span>
            )}
            <p className="mt-1.5 font-heading text-[11px] font-bold leading-tight">{medal.name}</p>
            <p className="mt-0.5 text-[10px] text-[var(--sdim)]">
              {medal.status === "en_revision" ? "en revisión" : `${RARITY_LABEL[medal.rarity]}${medal.is_physical ? " · física" : ""}`}
            </p>
            {medal.note && <p className="mt-1 truncate text-[10px] italic text-[var(--smut)]">“{medal.note}”</p>}
          </button>
        ))}
        {children}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[92] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(null)}
        >
          <div className="m-rowin w-full max-w-sm rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-5 text-center">
            <button type="button" aria-label="Cerrar" onClick={() => setOpen(null)} className="float-right text-[var(--sdim)] hover:text-[var(--stext)]">
              <X className="h-4 w-4" />
            </button>
            {open.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.photo_url} alt={open.name} className="mx-auto h-28 w-28 rounded-2xl border border-[var(--sline2)] object-cover" />
            ) : (
              <div className="text-6xl drop-shadow-[0_10px_24px_rgba(245,158,11,.3)]">{open.emoji}</div>
            )}
            <h3 className="mt-3 font-heading text-lg font-bold">{open.name}</h3>
            <p className="mt-0.5 text-xs text-[var(--sdim)]">
              {RARITY_LABEL[open.rarity]} · {new Date(open.awarded_at).toLocaleDateString("es-CL")}
              {open.is_physical ? " · física" : ""}
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              placeholder="Inmortaliza el momento: cómo se sintió, con quién estabas…"
              className="mt-4 min-h-20 w-full resize-y rounded-xl border border-[var(--sline)] bg-[var(--scard2)] p-3 text-left text-sm outline-none placeholder:text-[var(--sdim)] focus:border-stride-cyan"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--sline2)] py-2.5 text-sm font-semibold text-[var(--smut)] transition hover:border-[var(--stext)] hover:text-[var(--stext)]"
            >
              <Camera className="h-4 w-4" />
              {photo ? photo.name.slice(0, 26) : open.photo_url ? "Cambiar la foto del momento" : "Agregar foto del momento"}
            </button>
            <button type="button" onClick={save} disabled={pending} className="btn-primary mt-3 w-full px-4 py-2.5 text-sm disabled:opacity-60">
              {pending ? "Guardando…" : "Guardar recuerdo"}
            </button>
            {error && <p className="mt-2 text-xs font-semibold text-red-400">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
