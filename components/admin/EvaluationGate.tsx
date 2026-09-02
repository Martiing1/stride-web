"use client";

import { ClipboardCheck } from "lucide-react";
import { EvaluationForm } from "@/components/admin/EvaluationForm";
import { formatDateCL } from "@/lib/membership";
import type { StrideEvent } from "@/lib/types";

/**
 * Popup obligatorio post social run (02-09): reemplaza al módulo Evaluaciones.
 * Cubre todo el ERP y no se puede cerrar hasta entregar la evaluación; al
 * guardar, el layout se vuelve a renderizar sin pendientes y desaparece solo.
 */
export function EvaluationGate({ event, pendingCount }: { event: StrideEvent; pendingCount: number }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="eval-title">
      <div className="my-6 w-full max-w-2xl rounded-2xl border border-white/10 bg-stride-card p-6 shadow-2xl">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-stride-amber">
          <ClipboardCheck className="h-3.5 w-3.5" /> Evaluación pendiente{pendingCount > 1 ? ` · ${pendingCount} por entregar` : ""}
        </p>
        <h2 id="eval-title" className="mt-2 font-heading text-2xl font-extrabold text-white">{event.title}</h2>
        <p className="mt-1 text-sm text-white/50">
          {formatDateCL(event.event_date)} · Dos minutos. Tu mirada alimenta las métricas del evento y la revisión de fin de mes.
        </p>
        <div className="mt-5">
          <EvaluationForm eventId={event.id} embedded />
        </div>
      </div>
    </div>
  );
}
