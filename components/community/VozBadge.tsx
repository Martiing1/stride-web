import { Mic } from "lucide-react";
import clsx from "clsx";
import { DISTINCTION } from "@/lib/community-shared";

/** Insignia "Voz del mes" que acompaña al nombre de quienes más comentaron el mes pasado. */
export function VozBadge({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span
      title={`${DISTINCTION.label}: de quienes más comentaron el mes pasado`}
      className={clsx(
        "inline-flex flex-none items-center gap-1 rounded-full bg-stride-accent/12 px-1.5 py-0.5 text-[10px] font-bold leading-none text-stride-accent",
        className
      )}
    >
      <Mic className="h-2.5 w-2.5" aria-hidden />
      {compact ? <span className="sr-only">{DISTINCTION.label}</span> : DISTINCTION.label}
    </span>
  );
}
