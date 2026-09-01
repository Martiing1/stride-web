"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import { toggleLesson } from "@/app/miembros/community-actions";

export function LessonToggle({ lessonId, initial }: { lessonId: string; initial: boolean }) {
  const [done, setDone] = useState(initial);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label={done ? "Marcar pendiente" : "Marcar vista"}
      onClick={() => {
        const next = !done;
        setDone(next);
        startTransition(() => {
          void toggleLesson(lessonId, next);
        });
      }}
      className={clsx(
        "flex h-6 w-6 flex-none items-center justify-center rounded-full border-[1.6px] transition-all",
        done ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/25 text-transparent hover:border-white/50"
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
    </button>
  );
}
