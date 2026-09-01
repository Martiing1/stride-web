"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, MessageCircle, Medal, Star, CalendarDays, Target, Pause, CircleAlert } from "lucide-react";
import clsx from "clsx";
import { markNotificationsRead } from "@/app/miembros/community-actions";
import type { MemberNotification } from "@/lib/community";

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  comment: MessageCircle,
  like: Star,
  medal: Medal,
  points: Star,
  event: CalendarDays,
  reto: Target,
  pausa: Pause,
  general: CircleAlert,
};

export function BellButton({ unread, items }: { unread: number; items: MemberNotification[] }) {
  const [open, setOpen] = useState(false);
  const [badge, setBadge] = useState(unread);
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setBadge(unread), [unread]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const markRead = () => {
    setBadge(0);
    startTransition(() => {
      void markNotificationsRead();
    });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--sline2)] text-[var(--smut)] transition hover:bg-[var(--shover)] hover:text-[var(--stext)]"
      >
        <Bell className="h-4 w-4" />
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-stride-accent px-1 text-[10px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(88vw,340px)] rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-2 shadow-xl shadow-black/25">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--sdim)]">Sin novedades por ahora</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => {
                const Icon = KIND_ICONS[n.kind] ?? CircleAlert;
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href ?? "/miembros"}
                      onClick={() => setOpen(false)}
                      className={clsx(
                        "flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-[var(--shover)]",
                        !n.read && "bg-[var(--ssoft)]"
                      )}
                    >
                      <Icon className="mt-0.5 h-4 w-4 flex-none text-stride-accent" />
                      <span className="min-w-0">
                        <span className="block font-semibold leading-snug text-[var(--stext)]">{n.title}</span>
                        {n.body && <span className="block truncate text-xs text-[var(--sdim)]">{n.body}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {badge > 0 && (
            <button
              type="button"
              onClick={markRead}
              className="mt-1 w-full rounded-full border border-[var(--sline2)] py-2 text-xs font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]"
            >
              Marcar todas como leídas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
