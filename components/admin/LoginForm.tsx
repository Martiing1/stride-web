"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Step = "credentials" | "totp";

/**
 * Login del ERP en dos pasos: email + contraseña, y luego el código TOTP de la
 * app autenticadora.
 *
 * Supabase decide si el segundo paso es necesario comparando el nivel actual de
 * la sesión (aal1) con el que exige la cuenta (aal2). Una cuenta sin TOTP
 * inscrito entra directo y se le pide inscribirlo dentro del panel.
 */
export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("credentials");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Email o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    const { data: aal, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      setError("No pudimos verificar tu segundo factor. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    // La cuenta tiene TOTP inscrito y la sesión aún no lo cumple.
    if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];

      if (!totp) {
        setError("Tu cuenta requiere 2FA pero no tiene una app configurada. Habla con Martín.");
        setLoading(false);
        return;
      }

      setFactorId(totp.id);
      setStep("totp");
      setLoading(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  async function handleTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) return;

    setLoading(true);
    setError(null);

    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError || !challenge) {
      setError("No pudimos validar el código. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setError("Código incorrecto o vencido. Revisa tu app y prueba con el siguiente.");
      setLoading(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  if (step === "totp") {
    return (
      <form onSubmit={handleTotp} className="card space-y-5">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-9 w-9 text-stride-accent" />
          <h1 className="mt-3 font-heading text-xl font-bold text-white">Verificación en dos pasos</h1>
          <p className="mt-1 text-sm text-white/50">
            Escribe el código de 6 dígitos de tu app autenticadora.
          </p>
        </div>

        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          className="input text-center font-mono text-2xl tracking-[0.4em]"
          placeholder="000000"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCredentials} className="card space-y-4">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="input"
          placeholder="tu@stridechile.cl"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input"
          placeholder="••••••••"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <LogIn className="h-4 w-4" /> Entrar
          </>
        )}
      </button>
    </form>
  );
}
