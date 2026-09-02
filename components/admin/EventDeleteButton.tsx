"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteEvent } from "@/app/admin/eventos/actions";

/** Solo socios: elimina el evento con su planificación, encuesta e inscritos. */
export function EventDeleteButton({ eventId, title }: { eventId: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`¿Eliminar "${title}"? Se borran también su planificación, encuesta e inscritos. No se puede deshacer.`)) return;
    const form = new FormData();
    form.set("id", eventId);
    startTransition(async () => {
      const res = await deleteEvent(form);
      if (!res.ok) { alert(res.error ?? "No se pudo eliminar."); return; }
      router.push("/admin/eventos");
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={remove} disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/40 transition hover:border-red-400/40 hover:text-red-300">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Eliminar evento
    </button>
  );
}
