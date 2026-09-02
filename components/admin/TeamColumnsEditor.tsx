"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { saveTeamColumns } from "@/app/admin/configuracion/actions";
import type { TeamColumn } from "@/lib/app-settings";

/** Columnas extra de la ficha de cada persona del equipo: se agregan, renombran o eliminan acá. */
export function TeamColumnsEditor({ initial }: { initial: TeamColumn[] }) {
  const router = useRouter();
  const [cols, setCols] = useState<TeamColumn[]>(initial);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const slug = (label: string) =>
    label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);

  function save() {
    const form = new FormData();
    form.set("payload", JSON.stringify(cols.filter((c) => c.label.trim()).map((c) => ({ key: c.key || slug(c.label), label: c.label.trim() }))));
    setMsg(null);
    startTransition(async () => {
      const res = await saveTeamColumns(form);
      setMsg(res.ok ? { tone: "ok", text: "Columnas guardadas." } : { tone: "error", text: res.error ?? "No se pudo guardar." });
      if (res.ok) router.refresh();
    });
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-white">Columnas de la ficha de equipo</h2>
          <p className="mt-1 text-xs text-white/40">Teléfono, talla de polera, fecha de ingreso, RUT… lo que necesiten registrar por persona.</p>
        </div>
        <button type="button" onClick={() => setCols([...cols, { key: "", label: "" }])} className="btn-secondary px-4 py-2 text-sm">
          <Plus className="h-4 w-4" /> Añadir columna
        </button>
      </div>

      {cols.length === 0 ? (
        <p className="text-sm text-white/40">Sin columnas extra. Añade la primera.</p>
      ) : (
        <ul className="space-y-2">
          {cols.map((c, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input
                value={c.label}
                onChange={(e) => setCols(cols.map((x, j) => (j === i ? { label: e.target.value, key: x.key || slug(e.target.value) } : x)))}
                placeholder="Nombre de la columna"
                className="input min-w-[200px] flex-1 py-2 text-sm"
              />
              <input
                value={c.key}
                onChange={(e) => setCols(cols.map((x, j) => (j === i ? { ...x, key: slug(e.target.value) } : x)))}
                placeholder="clave"
                title="Clave interna (minúsculas, sin espacios)"
                className="input w-40 py-2 font-mono text-xs"
              />
              <button type="button" onClick={() => setCols(cols.filter((_, j) => j !== i))} aria-label="Eliminar columna"
                className="rounded-md p-2 text-white/30 hover:bg-red-500/10 hover:text-red-300">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary px-5 py-2 text-sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Guardar columnas</>}
        </button>
        {msg && <span className={`text-sm ${msg.tone === "ok" ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
