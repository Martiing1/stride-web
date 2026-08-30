"use client";

import { useState, useTransition } from "react";
import { ExternalLink, FileOutput, Loader2 } from "lucide-react";
import { exportPlanToDrive } from "@/app/admin/planificaciones/actions";

/** Exporta la planificación a un Documento de Google en TEAM STRIDE/Planificaciones. */
export function ExportPlanButton({ eventId }: { eventId: string }) {
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string; url?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    const form = new FormData();
    form.set("event_id", eventId);
    setResult(null);
    startTransition(async () => {
      const res = await exportPlanToDrive(form);
      setResult(
        res.ok
          ? { tone: "ok", text: "Documento creado en Drive → Planificaciones.", url: res.url }
          : { tone: "error", text: res.error ?? "No se pudo exportar." }
      );
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} disabled={pending} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileOutput className="h-4 w-4" />} Exportar a Drive
      </button>
      {result && (
        <span className={`text-sm ${result.tone === "ok" ? "text-emerald-300" : "text-red-300"}`}>
          {result.text}
          {result.url && (
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-stride-cyan hover:underline">
              Abrir <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </span>
      )}
    </div>
  );
}
