"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resolveChallengeProgress,
  resolvePhysicalMedal,
  resolvePause,
  type AdminResult,
} from "@/app/admin/comunidad/actions";

export interface QueueItem {
  id: string;
  kind: "reto" | "medalla" | "pausa";
  memberName: string;
  title: string;
  detail: string | null;
  mediaUrl: string | null;
  createdAt: string;
}

/** Cola de verificación: retos con evidencia, medallas físicas y pausas. */
export function CommunityQueues({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const resolve = (item: QueueItem, approve: boolean) => {
    setError(null);
    startTransition(async () => {
      let result: AdminResult;
      if (item.kind === "reto") result = await resolveChallengeProgress(item.id, approve);
      else if (item.kind === "medalla") result = await resolvePhysicalMedal(item.id, approve);
      else result = await resolvePause(item.id, approve);
      if (!result.ok) {
        setError(result.error ?? "No pudimos resolverla.");
        return;
      }
      setResolved((prev) => new Set(prev).add(item.id));
      router.refresh();
    });
  };

  const visible = items.filter((item) => !resolved.has(item.id));
  if (visible.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">
        Nada pendiente de verificar. Todo al día ✅
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
      {visible.map((item) => (
        <div key={`${item.kind}-${item.id}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-start gap-3">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/60">
              {item.kind === "reto" ? "🎯 Evidencia" : item.kind === "medalla" ? "🏅 Medalla física" : "⏸️ Pausa"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-sm font-bold">{item.memberName}</p>
              <p className="text-sm text-white/70">{item.title}</p>
              {item.detail && <p className="mt-1 text-xs text-white/45">«{item.detail}»</p>}
            </div>
          </div>
          {item.mediaUrl && (
            <a
              href={item.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-stride-cyan hover:bg-white/5"
            >
              Ver evidencia ↗
            </a>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => resolve(item, true)}
              className="rounded-full bg-emerald-500/15 px-5 py-2 font-heading text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              Aprobar ✓
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => resolve(item, false)}
              className="rounded-full border border-red-400/30 px-5 py-2 font-heading text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
