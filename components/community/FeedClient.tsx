"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { PostCard } from "./PostCard";
import type { Channel, FeedPost } from "@/lib/community";

const CHANNELS: Array<{ value: Channel | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "general", label: "General" },
  { value: "logros", label: "Logros" },
  { value: "presentacion", label: "Presentación" },
];

/**
 * Feed con filtros 100% en el cliente: cambiar de canal u orden es
 * instantáneo, sin round-trip al servidor.
 */
export function FeedClient({
  posts,
  emptyHint,
  adminView = false,
  canLike = true,
}: {
  posts: FeedPost[];
  emptyHint: string;
  adminView?: boolean;
  canLike?: boolean;
}) {
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [orden, setOrden] = useState<"actividad" | "recientes">("actividad");

  const visible = useMemo(() => {
    const filtered = channel === "all" ? posts : posts.filter((p) => p.channel === channel);
    return [...filtered].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      const keyA = orden === "actividad" ? a.last_activity : a.created_at;
      const keyB = orden === "actividad" ? b.last_activity : b.created_at;
      return keyB.localeCompare(keyA);
    });
  }, [posts, channel, orden]);

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
          {CHANNELS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setChannel(option.value)}
              className={clsx(
                "flex-none rounded-full border px-4 py-1.5 font-heading text-xs font-semibold transition",
                channel === option.value
                  ? "border-transparent bg-stride-accent text-white"
                  : "border-[var(--sline2)] text-[var(--smut)] hover:border-[var(--stext)]"
              )}
            >
              {option.label}
            </button>
          ))}
          <div className="ml-auto flex flex-none rounded-full border border-[var(--sline)] bg-[var(--scard2)] p-0.5">
            {(["actividad", "recientes"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setOrden(option)}
                className={clsx(
                  "rounded-full px-3 py-1 font-heading text-[11px] font-semibold capitalize transition",
                  orden === option ? "bg-[var(--shover)] text-[var(--stext)]" : "text-[var(--sdim)] hover:text-[var(--smut)]"
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--sline2)] p-10 text-center">
          <p className="font-heading font-bold">Nada por aquí todavía</p>
          <p className="mt-1 text-sm text-[var(--smut)]">{emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((post) => (
            <PostCard key={post.id} post={post} adminView={adminView} canLike={canLike} />
          ))}
        </div>
      )}
    </div>
  );
}
