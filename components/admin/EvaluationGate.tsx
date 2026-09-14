"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, ExternalLink, FolderOpen, Loader2 } from "lucide-react";
import { EvaluationForm } from "@/components/admin/EvaluationForm";
import { DriveUploader } from "@/components/admin/DriveUploader";
import { openEventFolder, type EventFolderResult } from "@/app/admin/documentos/actions";
import { formatDateCL } from "@/lib/membership";
import type { StrideEvent } from "@/lib/types";

/**
 * Popup obligatorio post social run (02-09): reemplaza al módulo Evaluaciones.
 * Cubre todo el ERP y no se puede cerrar hasta entregar la evaluación; al
 * guardar, el layout se vuelve a renderizar sin pendientes y desaparece solo.
 *
 * Al lado del formulario va la carpeta de Drive del evento (11-09), creada al
 * abrir el popup, para subir fotos y videos del día sin salir de acá.
 */
export function EvaluationGate({ event, pendingCount }: { event: StrideEvent; pendingCount: number }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="eval-title">
      <div className="my-6 w-full max-w-5xl rounded-2xl border border-white/10 bg-stride-card p-6 shadow-2xl">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-stride-amber">
          <ClipboardCheck className="h-3.5 w-3.5" /> Evaluación pendiente{pendingCount > 1 ? ` · ${pendingCount} por entregar` : ""}
        </p>
        <h2 id="eval-title" className="mt-2 font-heading text-2xl font-extrabold text-white">{event.title}</h2>
        <p className="mt-1 text-sm text-white/50">
          {formatDateCL(event.event_date)} · Dos minutos. Tu mirada alimenta las métricas del evento y la revisión de fin de mes.
        </p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <EvaluationForm eventId={event.id} embedded />
          <EventDrivePanel eventId={event.id} />
        </div>
      </div>
    </div>
  );
}

function EventDrivePanel({ eventId }: { eventId: string }) {
  const [state, setState] = useState<EventFolderResult | null>(null);

  const load = useCallback(() => {
    openEventFolder(eventId)
      .then(setState)
      .catch(() => setState({ ok: false, error: "No pudimos hablar con Google Drive." }));
  }, [eventId]);

  useEffect(load, [load]);

  const files = state?.files ?? [];

  return (
    <aside className="self-start rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <FolderOpen className="h-4 w-4 text-stride-cyan" /> Fotos y videos del evento
      </p>
      <p className="mt-1 text-xs leading-relaxed text-white/45">
        Lo que subas queda en la carpeta del evento en Drive. Es opcional: no hace falta para entregar la evaluación.
      </p>

      {!state ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparando la carpeta en Drive…
        </p>
      ) : !state.ok || !state.folder ? (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{state.error ?? "Error"}</p>
      ) : (
        <>
          <a href={state.folder.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1.5 text-xs text-white/60 hover:text-white">
            <span className="min-w-0 truncate">Drive / Eventos / {state.folder.name}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
          <div className="mt-3">
            <DriveUploader folderId={state.folder.id} onUploaded={load} compact />
          </div>
          {files.length > 0 && (
            <p className="mt-3 text-xs text-white/40">
              {files.length === 1 ? "1 archivo en la carpeta" : `${files.length} archivos en la carpeta`}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
