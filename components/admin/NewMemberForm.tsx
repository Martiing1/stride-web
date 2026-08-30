"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";
import { createMember } from "@/app/admin/miembros/actions";

/** Alta de miembro, tras confirmar el pago en Skool. */
export function NewMemberForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = event.currentTarget;
    const result = await createMember(new FormData(form));
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? "No se pudo crear.");
      return;
    }

    form.reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Nuevo miembro
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold text-white">Nuevo miembro</h2>
          <p className="text-sm text-white/45">
            Se crea su ficha. La invitación se envía después, cuando tú decidas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="full_name">
            Nombre completo
          </label>
          <input id="full_name" name="full_name" required className="input" />
        </div>

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" required className="input" />
        </div>

        <div>
          <label className="label" htmlFor="whatsapp">
            WhatsApp
          </label>
          <input id="whatsapp" name="whatsapp" type="tel" className="input" placeholder="+56 9 …" />
        </div>

        <div>
          <label className="label" htmlFor="valid_until">
            Vigente hasta
          </label>
          <input id="valid_until" name="valid_until" type="date" className="input" />
          <p className="mt-1 text-xs text-white/35">Vacío = sin vencimiento.</p>
        </div>

        <div>
          <label className="label" htmlFor="status">
            Estado
          </label>
          <select id="status" name="status" defaultValue="activa" className="input">
            <option value="activa" className="bg-stride-card">
              Activa
            </option>
            <option value="pausada" className="bg-stride-card">
              Pausada
            </option>
            <option value="inactiva" className="bg-stride-card">
              Inactiva
            </option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear miembro"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Cancelar
        </button>
      </div>
    </form>
  );
}
