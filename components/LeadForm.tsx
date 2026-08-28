"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { MOTIVATION_OPTIONS } from "@/lib/lead-options";
import { SITE } from "@/lib/site";

const CONSENT_VERSION = "2026-08-27";

export function LeadForm({ source = "landing" }: { source?: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [motivation, setMotivation] = useState<string>("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      full_name: String(form.get("full_name") ?? ""),
      email: String(form.get("email") ?? ""),
      whatsapp: String(form.get("whatsapp") ?? ""),
      motivation: String(form.get("motivation") ?? ""),
      contact_consent: form.get("contact_consent") === "on",
      marketing_consent: form.get("marketing_consent") === "on",
      consent_version: CONSENT_VERSION,
      website: String(form.get("website") ?? ""),
      source,
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Algo falló. Intenta de nuevo.");
        setStatus("idle");
        return;
      }

      setStatus("done");
    } catch {
      setError("Sin conexión. Revisa tu internet e intenta de nuevo.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="card flex flex-col items-center gap-3 py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-400" />
        <p className="font-heading text-xl font-bold text-white">
          {motivation === "membresia" ? "¡Bienvenido!" : "¡Nos vemos en la calle!"}
        </p>
        <p className="max-w-xs text-sm leading-relaxed text-white/65">
          {motivation === "membresia"
            ? `Te escribimos por WhatsApp con todo lo que necesitas para entrar a ${SITE.membership.name}.`
            : "Te escribimos por WhatsApp con el punto de encuentro del próximo Social Run."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      {/*
        La motivación abre el formulario: define el tono de la conversación por
        WhatsApp y dice si la persona es candidata a la membresía o solo viene
        al Social Run.
      */}
      <fieldset>
        <legend className="label">¿Qué te trae a STRIDE?</legend>
        <div className="space-y-2">
          {MOTIVATION_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                motivation === option.value
                  ? "border-stride-cyan/60 bg-stride-cyan/5"
                  : "border-white/10 hover:border-white/25"
              }`}
            >
              <input
                type="radio"
                name="motivation"
                value={option.value}
                required
                checked={motivation === option.value}
                onChange={(e) => setMotivation(e.target.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-stride-accent"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white">{option.label}</span>
                <span className="block text-xs text-white/45">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-4 border-t border-white/10 pt-5">
        <div>
          <label className="label" htmlFor="full_name">
            Nombre
          </label>
          <input
            id="full_name"
            name="full_name"
            required
            minLength={2}
            autoComplete="name"
            className="input"
            placeholder="Tu nombre"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
              className="input"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="whatsapp">
              WhatsApp
            </label>
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              required
              autoComplete="tel"
              className="input"
              placeholder="+56 9 1234 5678"
            />
          </div>
        </div>

      </div>

      <fieldset className="space-y-3 border-t border-white/10 pt-5">
        <legend className="sr-only">Autorizaciones de contacto y datos personales</legend>

        <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-white/65">
          <input
            type="checkbox"
            name="contact_consent"
            required
            className="mt-0.5 h-4 w-4 shrink-0 accent-stride-accent"
          />
          <span>
            Autorizo a STRIDE a tratar mi nombre, email y WhatsApp para responder esta solicitud
            y contactarme sobre la opción que marqué. He leído la{" "}
            <a href="/privacidad" target="_blank" className="text-stride-cyan underline underline-offset-2">
              Política de Privacidad
            </a>
            .
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-white/65">
          <input
            type="checkbox"
            name="marketing_consent"
            className="mt-0.5 h-4 w-4 shrink-0 accent-stride-accent"
          />
          <span>
            También quiero recibir novedades sobre próximos Social Runs, actividades y STRIDE
            ONE por WhatsApp o email. Esta autorización es opcional y puedo retirarla cuando quiera.
          </span>
        </label>
      </fieldset>

      {/* Honeypot anti-bots: oculto para personas, tentador para scripts. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={status === "sending"}
        className="btn-primary btn-gradient-flow btn-shine w-full"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
          </>
        ) : (
          <>
            {motivation === "membresia" ? "Quiero entrar" : "Quiero sumarme"}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

    </form>
  );
}
