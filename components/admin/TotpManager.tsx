"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
}

/**
 * Inscripción del segundo factor (TOTP) del ERP.
 *
 * Supabase ya exige el código en el login de toda cuenta que tenga un factor
 * verificado; lo que faltaba era la pantalla para inscribirlo. Sin ella el ERP
 * quedaba protegido solo por contraseña.
 */
export function TotpManager({ accountEmail }: { accountEmail: string | null }) {
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError("No pudimos leer el estado de tu segundo factor.");
      setLoading(false);
      return;
    }
    setEnrolled((data?.totp ?? []).some((f) => f.status === "verified"));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startEnrollment() {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // Un intento anterior abandonado deja un factor sin verificar que bloquea
    // el nombre. Se limpian antes de crear el nuevo.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const factor of existing?.all ?? []) {
      if (factor.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `STRIDE ERP · ${new Date().toISOString().slice(0, 10)}`,
      issuer: "STRIDE ERP",
    });

    if (enrollError || !data) {
      setError("No pudimos generar el código. Recarga la página e intenta de nuevo.");
      setBusy(false);
      return;
    }

    setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setBusy(false);
  }

  async function confirmEnrollment(event: React.FormEvent) {
    event.preventDefault();
    if (!enrolling) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.factorId,
      code: code.trim(),
    });

    if (verifyError) {
      setError("Ese código no coincide. Revisa que la hora del teléfono esté automática e inténtalo otra vez.");
      setBusy(false);
      return;
    }

    setEnrolling(null);
    setCode("");
    setBusy(false);
    await load();
  }

  async function cancelEnrollment() {
    if (!enrolling) return;
    const supabase = createClient();
    await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    setEnrolling(null);
    setCode("");
    setError(null);
  }

  async function disable() {
    if (!window.confirm("¿Desactivar el segundo factor? El ERP quedará protegido solo por contraseña.")) return;
    setBusy(true);
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    for (const factor of data?.all ?? []) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    setBusy(false);
    await load();
  }

  if (loading) {
    return (
      <div className="card flex items-center gap-3 p-6 text-sm text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" /> Revisando tu cuenta…
      </div>
    );
  }

  return (
    <div className="card space-y-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {enrolled ? <ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-400" /> : <ShieldOff className="mt-0.5 h-6 w-6 text-amber-400" />}
          <div>
            <p className="font-heading text-lg font-bold">
              {enrolled ? "Segundo factor activo" : "Segundo factor sin configurar"}
            </p>
            <p className="mt-1 text-sm text-white/50">
              {enrolled
                ? "Cada vez que entres se te pedirá el código de tu app autenticadora."
                : "Hoy tu cuenta entra solo con la contraseña."}
            </p>
            {accountEmail && <p className="mt-2 font-mono text-xs text-white/30">{accountEmail}</p>}
          </div>
        </div>
        {enrolled && (
          <button type="button" onClick={() => void disable()} disabled={busy} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:border-red-400/40 hover:text-red-300">
            Desactivar
          </button>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {!enrolled && !enrolling && (
        <div>
          <button type="button" onClick={() => void startEnrollment()} disabled={busy} className="btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Smartphone className="h-4 w-4" /> Activar segundo factor</>}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-white/35">
            Necesitas una app autenticadora en el teléfono: Google Authenticator, Authy o la de tu gestor de contraseñas.
          </p>
        </div>
      )}

      {enrolling && (
        <form onSubmit={confirmEnrollment} className="space-y-5 border-t border-white/5 pt-5">
          <ol className="space-y-4 text-sm text-white/60">
            <li>
              <p className="font-medium text-white">1. Escanea este código con tu app autenticadora</p>
              <div className="mt-3 inline-block rounded-2xl bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URI que genera Supabase */}
                <img src={enrolling.qrCode} alt="Código QR para la app autenticadora" width={180} height={180} />
              </div>
            </li>
            <li>
              <p className="font-medium text-white">Si no puedes escanear, escribe esta clave</p>
              <code className="mt-2 block break-all rounded-lg bg-black/30 p-3 font-mono text-xs tracking-wider text-white/70">{enrolling.secret}</code>
            </li>
            <li>
              <label htmlFor="totp-code" className="font-medium text-white">2. Escribe el código de 6 dígitos que aparece</label>
              <input id="totp-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus className="input mt-2 max-w-[200px] text-center font-mono text-xl tracking-[0.3em]" placeholder="000000" />
            </li>
          </ol>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Confirmar</>}
            </button>
            <button type="button" onClick={() => void cancelEnrollment()} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
