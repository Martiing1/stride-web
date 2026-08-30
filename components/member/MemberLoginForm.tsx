"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Feedback = { tone: "info" | "error"; text: string } | null;

/** Traduce los errores de Supabase a algo accionable para el miembro. */
function describeOtpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many"))
    return "Pediste varios códigos seguidos. Espera unos minutos antes de intentarlo de nuevo.";
  if (m.includes("signups not allowed") || m.includes("otp_disabled"))
    return "No pudimos enviarte el código. Puede que tu correo todavía no esté habilitado: escríbenos por WhatsApp y lo activamos.";
  return "No pudimos enviar el código. Revisa el correo que escribiste e inténtalo de nuevo.";
}

export function MemberLoginForm({ initialError }: { initialError?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(
    initialError ? { tone: "error", text: initialError } : null
  );

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);

    const normalized = email.trim().toLowerCase();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/miembros`,
      },
    });

    // Un fallo acá deja al miembro esperando un correo que nunca llega: hay que decirlo.
    if (error) {
      setFeedback({ tone: "error", text: describeOtpError(error.message) });
      setLoading(false);
      return;
    }

    setEmail(normalized);
    setStep("code");
    setFeedback({
      tone: "info",
      text: "Te enviamos un correo. Usa el código o el enlace, no los dos: al abrir uno, el otro deja de servir.",
    });
    setLoading(false);
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);

    const token = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

    if (error) {
      // Solo vive el último código pedido, y abrir el enlace lo consume: decirlo
      // evita que la persona insista con un correo viejo creyendo que falla el sistema.
      setFeedback({
        tone: "error",
        text: "Ese código ya no sirve. Solo funciona el del último correo, y deja de servir si abriste el enlace. Pide uno nuevo.",
      });
      setLoading(false);
      return;
    }

    router.replace("/miembros");
    router.refresh();
  }

  const message = feedback && (
    <p className={`text-sm leading-relaxed ${feedback.tone === "error" ? "rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-red-200" : "text-white/55"}`}>
      {feedback.text}
    </p>
  );

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="member-panel space-y-5">
        <ShieldCheck className="h-9 w-9 text-stride-cyan" />
        <div><h1 className="font-heading text-2xl font-bold">Revisa tu correo</h1><p className="mt-2 text-sm leading-relaxed text-white/55">Enviamos un código a <strong className="text-white/80">{email}</strong>. Escríbelo aquí, o abre el enlace del correo desde este mismo dispositivo.</p></div>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" maxLength={8} required autoFocus className="input text-center font-mono text-2xl tracking-[0.35em]" placeholder="000000" />
        {message}
        <button type="submit" disabled={loading} className="btn-primary btn-gradient-flow w-full">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Entrar a mi carnet <ArrowRight className="h-4 w-4" /></>}</button>
        <button type="button" onClick={() => { setStep("email"); setFeedback(null); }} className="w-full text-sm text-white/45 hover:text-white">Usar otro correo</button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="member-panel space-y-5">
      <Mail className="h-9 w-9 text-stride-cyan" />
      <div><h1 className="font-heading text-2xl font-bold">Tu espacio STRIDE ONE</h1><p className="mt-2 text-sm leading-relaxed text-white/55">Ingresa con el correo asociado a tu membresía. No necesitas contraseña.</p></div>
      <div><label htmlFor="member-email" className="label">Email</label><input id="member-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input" placeholder="tu@email.com" /></div>
      {message}
      <button type="submit" disabled={loading} className="btn-primary btn-gradient-flow w-full">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Recibir código <ArrowRight className="h-4 w-4" /></>}</button>
    </form>
  );
}
