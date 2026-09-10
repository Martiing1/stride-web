import { Crown } from "lucide-react";
import clsx from "clsx";
import { DISTINCTION } from "@/lib/community-shared";

/** Insignia del Nº1: la lleva quien ganó el ranking del mes pasado, todo este mes. */
export function NumeroUnoBadge({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span
      title={`${DISTINCTION.label}: ganó el ranking por puntos del mes pasado`}
      className={clsx(
        "inline-flex flex-none items-center gap-1 rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-500",
        className
      )}
    >
      <Crown className="h-2.5 w-2.5" aria-hidden />
      {compact ? <span className="sr-only">{DISTINCTION.label}</span> : DISTINCTION.label}
    </span>
  );
}
