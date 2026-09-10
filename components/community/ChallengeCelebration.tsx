"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { createPost, publishMedalPost } from "@/app/miembros/community-actions";
import { ShareButton } from "@/components/community/ShareCardModal";
import { MedalBadge, RARITY_LABEL, medalColor } from "@/components/community/MedalBadge";
import { MEDAL_STOPS, type ShareCardData } from "@/lib/share-card";

/** Lo que devuelve el servidor al cumplir un reto: alimenta el popup. */
export interface Completed {
  title: string;
  points: number;
  medal: { name: string; rarity: string; emoji: string } | null;
  /** Fila de member_medals recién creada: sirve para publicarla al blog. */
  memberMedalId?: string | null;
}

const CONFETTI = ["#00E5FF", "#6366F1", "#7C3AED", "#ffffff", "#c4b5fd", "#67e8f9"];

/**
 * Chaya. Tres olas: un estallido desde la medalla, una lluvia desde arriba y
 * una segunda lluvia rezagada. Con medalla, suma los tonos del metal.
 */
function throwConfetti(rarity?: string | null) {
  const metal = rarity && rarity in MEDAL_STOPS ? MEDAL_STOPS[rarity as keyof typeof MEDAL_STOPS] : [];
  const palette = [...CONFETTI, ...metal, ...metal];
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:98;overflow:hidden";
  document.body.appendChild(host);
  const W = window.innerWidth;
  const H = window.innerHeight;

  const wave = (count: number, delay: number, burst: boolean) => {
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("i");
      const size = 6 + Math.random() * 8;
      const round = Math.random() < 0.3;
      const left = burst ? 50 + (Math.random() - 0.5) * 24 : 2 + Math.random() * 96;
      piece.style.cssText = `position:absolute;top:${burst ? 42 : -3}%;left:${left}%;width:${size}px;height:${round ? size : size * 1.7}px;border-radius:${round ? "50%" : "2px"};background:${palette[i % palette.length]};opacity:0`;
      host.appendChild(piece);
      const spin = (Math.random() > 0.5 ? 1 : -1) * (400 + Math.random() * 700);
      if (burst) {
        const dx = (Math.random() - 0.5) * W * 1.3;
        const up = -(180 + Math.random() * 420);
        piece.animate(
          [
            { transform: "translate(0,0) rotate(0)", opacity: 1, offset: 0 },
            { transform: `translate(${dx * 0.55}px, ${up}px) rotate(${spin * 0.4}deg)`, opacity: 1, offset: 0.32 },
            { transform: `translate(${dx}px, ${H * 0.65}px) rotate(${spin}deg)`, opacity: 0, offset: 1 },
          ],
          { duration: 2500 + Math.random() * 900, delay: delay + Math.random() * 140, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" }
        );
      } else {
        piece.animate(
          [
            { transform: "translate(0,0) rotate(0)", opacity: 1 },
            { transform: `translate(${(Math.random() - 0.5) * 180}px, ${H * (0.75 + Math.random() * 0.4)}px) rotate(${spin}deg)`, opacity: 0 },
          ],
          { duration: 2800 + Math.random() * 1600, delay: delay + Math.random() * 800, easing: "cubic-bezier(.15,.6,.4,1)", fill: "forwards" }
        );
      }
    }
  };
  wave(70, 120, true);
  wave(110, 300, false);
  wave(60, 1500, false);
  return () => host.remove();
}

/**
 * Popup de reto cumplido: la medalla entra con rebote, cae la chaya y se
 * ofrece compartir afuera (Instagram) o dejarlo en el blog.
 */
export function ChallengeCelebration({
  completed,
  share,
  onClose,
}: {
  completed: Completed;
  /** Tarjeta que se manda a Instagram (la arma la tarjeta de reto). */
  share: ShareCardData;
  onClose: () => void;
}) {
  const router = useRouter();
  const [blog, setBlog] = useState<"idle" | "posting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    if (reduced) return;
    const stop = throwConfetti(completed.medal?.rarity);
    const timer = window.setTimeout(stop, 6200);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [completed, reduced]);

  /** La medalla (o el logro) al blog, con los puntos de publicar incluidos. */
  const publish = () => {
    if (blog !== "idle" || pending) return;
    setBlog("posting");
    setError(null);
    startTransition(async () => {
      let result;
      if (completed.memberMedalId) {
        result = await publishMedalPost(completed.memberMedalId);
      } else {
        const formData = new FormData();
        formData.set("body", `¡Cumplí el reto «${completed.title}»! 🏅 +${completed.points} pts`);
        formData.set("channel", "logros");
        result = await createPost(formData);
      }
      if (!result.ok) {
        setBlog("idle");
        setError(result.error ?? "No pudimos publicar.");
        return;
      }
      setBlog("done");
      router.refresh();
    });
  };

  const glow = completed.medal ? medalColor(completed.medal.rarity) : "#7C3AED";

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/85 p-6 text-center backdrop-blur-md">
      <div className="m-rowin w-full max-w-xs">
        <div className="medal-pop mx-auto w-fit" style={{ filter: `drop-shadow(0 18px 40px ${glow}66)` }}>
          {completed.medal ? (
            <MedalBadge rarity={completed.medal.rarity} emoji={completed.medal.emoji} size={168} />
          ) : (
            <div className="gradient-surface flex h-40 w-40 items-center justify-center rounded-full font-heading text-4xl font-extrabold text-white">
              +{completed.points}
            </div>
          )}
        </div>
        <h2 className="wordmark mt-5 font-heading text-2xl font-extrabold">¡RETO CUMPLIDO!</h2>
        <p className="mt-1 text-sm text-white/85">{completed.title}</p>
        {completed.medal && (
          <p className="mt-2 font-heading text-sm font-bold" style={{ color: glow }}>
            Medalla {completed.medal.name} · {RARITY_LABEL[completed.medal.rarity] ?? completed.medal.rarity}
          </p>
        )}
        <p className="mt-1 text-sm text-white/60">
          +{completed.points} pts{completed.medal ? " · ya brilla en tu vitrina" : ""}
        </p>

        <ShareButton data={share} label="Compartir en Instagram" variant="primary" className="mt-6 w-full" />
        <button
          type="button"
          onClick={publish}
          disabled={blog !== "idle"}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 font-heading text-sm font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-80"
        >
          {blog === "done" ? (
            "Publicado en el blog ✓"
          ) : blog === "posting" ? (
            "Publicando…"
          ) : (
            <>
              <PenLine className="h-4 w-4" /> Publicar en el blog
            </>
          )}
        </button>
        {error && <p className="mt-2 text-xs font-semibold text-red-400">{error}</p>}
        <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-sm text-white/55 transition hover:text-white">
          {blog === "done" ? "Listo" : "Ahora no"}
        </button>
      </div>
    </div>
  );
}
