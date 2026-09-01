"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestPause } from "@/app/miembros/community-actions";

/** Solicitud de pausa con nota: el staff aprueba y las rachas quedan protegidas. */
export function PauseCard({ hasPending }: { hasPending: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(hasPending);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!note.trim()) {
      setError("Cuéntanos el motivo primero.");
      return;
    }
    startTransition(async () => {
      const result = await requestPause(note);
      if (!result.ok) {
        setError(result.error ?? "No pudimos enviar la solicitud.");
        return;
      }
      setSent(true);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-5">
      <h2 className="font-heading text-base font-bold">Membresía</h2>
      <p className="mt-2 text-sm text-[var(--smut)]">
        ¿Lesión o viaje? Puedes <b className="text-[var(--stext)]">pausar</b> tu membresía: el staff aprueba
        la solicitud y tus rachas quedan protegidas mientras dure.
      </p>

      {sent ? (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-500">
          Pausa solicitada · esperando aprobación del staff
        </p>
      ) : open ? (
        <div className="mt-4 space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: me lesioné el tobillo, el kine me dio 3 semanas de pausa…"
            className="min-h-20 w-full resize-y rounded-xl border border-[var(--sline)] bg-[var(--scard2)] p-3.5 text-sm outline-none placeholder:text-[var(--sdim)] focus:border-stride-cyan"
          />
          <div className="flex gap-2">
            <button type="button" onClick={submit} disabled={pending} className="btn-primary flex-1 px-4 py-2.5 text-sm disabled:opacity-60">
              {pending ? "Enviando…" : "Enviar solicitud"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-[var(--sline2)] px-4 py-2 text-sm text-[var(--smut)] hover:bg-[var(--shover)]"
            >
              Cancelar
            </button>
          </div>
          {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-full border border-[var(--sline2)] px-5 py-2.5 font-heading text-sm font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]"
        >
          Solicitar pausa
        </button>
      )}
    </div>
  );
}
