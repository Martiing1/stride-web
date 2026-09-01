"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDisplayName } from "@/app/miembros/community-actions";

/** Cambia el nombre con el que el miembro aparece en el Blog y el Ranking. */
export function DisplayNameForm({ initial, realName }: { initial: string; realName: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await updateDisplayName(value);
      if (!result.ok) return setError(result.error ?? "No pudimos guardar.");
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    });
  };

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={40}
          placeholder={realName}
          className="min-w-0 flex-1 rounded-xl border border-[var(--sline2)] bg-[var(--scard2)] px-3.5 py-2.5 text-sm text-[var(--stext)] outline-none focus:border-stride-accent"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || value.trim() === initial.trim()}
          className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {pending ? "Guardando…" : saved ? "Listo ✓" : "Guardar"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-400">{error}</p>}
      <p className="mt-2.5 text-xs text-[var(--sdim)]">
        Así te verán en el Blog, los comentarios y el Ranking. Tu nombre completo ({realName}) se mantiene en tu
        carnet y en la membresía.
      </p>
    </div>
  );
}
