"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { updateTaskStatus } from "@/app/admin/tareas/actions";

/** Devuelve una tarea archivada al tablero como pendiente. */
export function ReopenTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function reopen() {
    const form = new FormData();
    form.set("id", taskId);
    form.set("status", "pendiente");
    startTransition(async () => {
      await updateTaskStatus(form);
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={reopen} disabled={pending} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Reabrir
    </button>
  );
}
