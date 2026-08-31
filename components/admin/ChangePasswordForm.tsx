"use client";

import { useState, type FormEvent } from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Cambio de contraseña de la propia cuenta, desde Seguridad. */
export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (password.length < 10) {
      setMessage({ tone: "error", text: "Mínimo 10 caracteres. Mezcla palabras y números." });
      return;
    }
    if (password !== confirm) {
      setMessage({ tone: "error", text: "Las contraseñas no coinciden." });
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setMessage({
        tone: "error",
        text: error.message.toLowerCase().includes("different")
          ? "La nueva contraseña debe ser distinta a la actual."
          : "No se pudo cambiar. Cierra sesión, vuelve a entrar e inténtalo de nuevo.",
      });
      return;
    }
    setPassword("");
    setConfirm("");
    setMessage({ tone: "ok", text: "Contraseña cambiada. Úsala desde tu próximo ingreso." });
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-6 w-6 text-stride-cyan" />
        <div>
          <p className="font-heading text-lg font-bold">Cambiar contraseña</p>
          <p className="mt-1 text-sm text-white/45">
            Si entraste con una contraseña temporal, cámbiala aquí por una tuya.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-password" className="label">Nueva contraseña</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="label">Repítela</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
          />
        </div>
      </div>

      {message && (
        <p className={`rounded-xl border p-3 text-sm ${message.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-red-400/30 bg-red-500/10 text-red-200"}`}>
          {message.text}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Cambiar contraseña</>}
      </button>
    </form>
  );
}
