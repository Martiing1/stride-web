"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { rsvpEvent } from "@/app/miembros/community-actions";

export function RsvpButtons({ eventId, initial }: { eventId: string; initial: "voy" | "no_voy" | null }) {
  const [value, setValue] = useState(initial);
  const [, startTransition] = useTransition();

  const set = (response: "voy" | "no_voy") => {
    setValue(response);
    startTransition(() => {
      void rsvpEvent(eventId, response);
    });
  };

  return (
    <div className="flex rounded-full border border-[var(--sline)] bg-[var(--scard2)] p-0.5">
      <button
        type="button"
        onClick={() => set("voy")}
        className={clsx(
          "rounded-full px-3.5 py-1.5 font-heading text-xs font-semibold transition",
          value === "voy" ? "bg-emerald-500/20 text-emerald-500" : "text-[var(--sdim)] hover:text-emerald-500"
        )}
      >
        Voy
      </button>
      <button
        type="button"
        onClick={() => set("no_voy")}
        className={clsx(
          "rounded-full px-3.5 py-1.5 font-heading text-xs font-semibold transition",
          value === "no_voy" ? "bg-[var(--shover)] text-[var(--stext)]" : "text-[var(--sdim)] hover:text-[var(--stext)]"
        )}
      >
        No voy
      </button>
    </div>
  );
}
