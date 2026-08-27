"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ActivationState = "checking" | "ready" | "saving" | "done" | "invalid";

export function ActivationForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<ActivationState>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let resolved = false;

    const markSessionReady = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      if (session) {
        resolved = true;
        window.history.replaceState({}, "", window.location.pathname);
        setState("ready");
      } else {
        const params = new URLSearchParams(window.location.hash.slice(1));
        if (params.get("error")) {
          resolved = true;
          setError("Este enlace ya fue usado o venció. Solicita uno nuevo para continuar.");
          setState("invalid");
        }
      }
    };

    void markSessionReady();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session) return;
      resolved = true;
      window.history.replaceState({}, "", window.location.pathname);
      setState("ready");
    });

    const timeout = window.setTimeout(() => {
      if (active && !resolved) {
        setState("invalid");
        setError("No encontramos una sesión válida. Abre el enlace más reciente de tu correo.");
      }
    }, 4000);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
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
      router.replace("/admin");
      router.refresh();
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
