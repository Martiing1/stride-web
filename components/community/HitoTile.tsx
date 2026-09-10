"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import clsx from "clsx";
import { ShareCardModal } from "@/components/community/ShareCardModal";
import { MedalBadge, asRarity } from "@/components/community/MedalBadge";
import type { ChallengeView } from "@/lib/community";

/**
 * Hito permanente. Los conseguidos se pueden tocar para compartirlos: son la
 * medalla más presumible que tiene la plataforma.
 */
export function HitoTile({ hito }: { hito: ChallengeView }) {
  const [open, setOpen] = useState(false);
  const done = hito.status === "cumplido";

  const tile = (
    <>
      <MedalBadge rarity={hito.medal?.rarity ?? "oro"} emoji={hito.medal?.emoji ?? "🏅"} size={44} muted={!done} className="mx-auto" />
      <p className="mt-1.5 font-heading text-[11px] font-bold leading-tight">{hito.title}</p>
      <p className="mt-0.5 text-[10px] text-[var(--sdim)]">{done ? "conseguido" : "bloqueado"}</p>
    </>
  );

  if (!done) {
    return <div className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] px-3 py-4 text-center opacity-60">{tile}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          "group relative rounded-2xl border border-amber-500/40 bg-[var(--scard)] px-3 py-4 text-center transition",
          "hover:-translate-y-0.5 hover:border-amber-500/70 hover:bg-[var(--shover)]"
        )}
      >
        {tile}
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-stride-accent">
          <Share2 className="h-3 w-3" /> compartir
        </span>
      </button>
      {open && (
        <ShareCardModal
          data={{
            headline: "Hito conseguido",
            title: hito.title,
            stats: [
              { label: "Puntos", value: `+${hito.points}` },
              ...(hito.medal ? [{ label: "Medalla", value: hito.medal.name, tint: true }] : []),
            ],
            medal: asRarity(hito.medal?.rarity),
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
