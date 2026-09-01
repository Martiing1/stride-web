"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SITE } from "@/lib/site";

type ActivationState = "checking" | "ready" | "saving" | "done" | "invalid";

export function ActivationForm() {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<ActivationState>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    /** Borra el token de la barra de direcciones apenas se canjea. */
    const cleanUrl = () =>
      window.history.replaceState({}, "", window.location.pathname);

    const start = async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));

      // Enlace ya usado o vencido: Supabase lo informa en el propio hash.
      if (hash.get("error")) {
        if (!active) return;
        cleanUrl();
        setError(
          hash.get("error_code") === "otp_expired"
            ? "Este enlace ya venció o fue abierto antes por el escáner de tu correo. Solicita uno nuevo."
            : "Este enlace no es válido. Solicita uno nuevo para continuar."
        );
        setState("invalid");
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      // El enlace de recuperación llega en flujo implícito (tokens en el
      // hash), pero createBrowserClient usa PKCE y no lo procesa solo. Hay
      // que canjear los tokens a mano.
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!active) return;
        cleanUrl();

        if (sessionError) {
          setError("Este enlace ya venció. Solicita uno nuevo para continuar.");
          setState("invalid");
          return;
        }

        setState("ready");
        return;
      }

      // Sin tokens en la URL: puede haber una sesión previa en cookies.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session) {
        setState("ready");
      } else {
        setError("No encontramos una sesión válida. Abre el enlace más reciente de tu correo.");
        setState("invalid");
      }
    };

    void start();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password.length < 10) {
      setError("Usa una contraseña de al menos 10 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setState("saving");
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("No pudimos guardar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.");
      setState("ready");
      return;
    }

    setState("done");
    window.setTimeout(() => {
      // El ERP vive solo en el subdominio admin. La sesión de activación se
      // crea en el dominio público, así que la persona entra allá usando la
      // contraseña que acaba de definir.
      window.location.assign(SITE.adminUrl);
    }, 700);
  }

  if (state === "checking") {
    return (
      <div className="card flex items-center justify-center gap-3 py-10 text-sm text-white/60">
        <Loader2 className="h-5 w-5 animate-spin text-stride-accent" />
        Validando tu acceso…
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="card space-y-4 text-center">
        <KeyRound className="mx-auto h-9 w-9 text-stride-accent" />
        <h1 className="font-heading text-xl font-bold text-white">El enlace no es válido</h1>
        <p className="text-sm leading-relaxed text-white/55">{error}</p>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="card space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
        <h1 className="font-heading text-xl font-bold text-white">Acceso activado</h1>
        <p className="text-sm text-white/55">Entrando al ERP de STRIDE…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="text-center">
        <KeyRound className="mx-auto h-9 w-9 text-stride-accent" />
        <h1 className="mt-3 font-heading text-xl font-bold text-white">Crea tu contraseña</h1>
        <p className="mt-1 text-sm text-white/50">Será tu acceso personal al ERP de STRIDE.</p>
      </div>

      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="input"
          placeholder="Mínimo 10 caracteres"
        />
      </div>

      <div>
        <label className="label" htmlFor="confirmation">Repite la contraseña</label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="input"
          placeholder="Repite tu contraseña"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button type="submit" disabled={state === "saving"} className="btn-primary w-full">
        {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activar acceso"}
      </button>
    </form>
  );
}
