"use client";

import { useEffect } from "react";
import { CircleCheck } from "lucide-react";
import { ShareButton } from "@/components/community/ShareCardModal";
import type { ShareCardData } from "@/lib/share-card";

/**
 * Lo que aparece apenas se registra un avance o se manda una evidencia: la
 * confirmación y, en grande, el botón para llevarlo a Instagram. Cuando el
 * registro además cumple el reto, en vez de esto sale ChallengeCelebration.
 */
export function RegisteredSheet({
  title,
  detail,
  share,
  onClose,
}: {
  title: string;
  detail: string;
  share: ShareCardData;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[93] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="m-rowin w-full max-w-sm rounded-3xl border border-[var(--sline)] bg-[var(--scard)] p-6 text-center">
        <CircleCheck className="mx-auto h-11 w-11 text-emerald-500" />
        <h3 className="mt-3 font-heading text-xl font-bold">{title}</h3>
        <p className="mt-1 text-sm text-[var(--smut)]">{detail}</p>
        <ShareButton data={share} label="Compartir" variant="hero" className="mt-6" />
        <button type="button" onClick={onClose} className="mt-2 w-full py-2.5 text-sm text-[var(--sdim)] transition hover:text-[var(--stext)]">
          Ahora no
        </button>
      </div>
    </div>
  );
}
