"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, ShieldCheck, WifiOff } from "lucide-react";

interface InitialQr { url: string; expiresAt: number }

export function RotatingMemberQR({ initial }: { initial: InitialQr }) {
  const [qr, setQr] = useState(initial);
  // Valor determinista para que el HTML del servidor y la hidratación coincidan.
  // El reloj real toma el control inmediatamente después de montar.
  const [now, setNow] = useState(initial.expiresAt - 60_000);
  const [offline, setOffline] = useState(false);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const response = await fetch("/api/miembros/qr", { cache: "no-store" });
      if (!response.ok) throw new Error("No disponible");
      const next = await response.json() as InitialQr;
      setQr(next);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    const delay = Math.max(250, qr.expiresAt - Date.now() + 150);
    const timer = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(timer);
  }, [qr.expiresAt, refresh]);

  useEffect(() => {
    if (now >= qr.expiresAt && offline) {
      const retry = window.setTimeout(() => void refresh(), 5000);
      return () => window.clearTimeout(retry);
    }
  }, [now, offline, qr.expiresAt, refresh]);

  const seconds = Math.max(0, Math.ceil((qr.expiresAt - now) / 1000));
  const expired = seconds === 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`rounded-2xl bg-white p-4 transition ${expired ? "opacity-25 grayscale" : ""}`}>
        <QRCodeSVG value={qr.url} size={210} level="M" marginSize={2} bgColor="#FFFFFF" fgColor="#0A0A0A" />
      </div>
      <div className="flex min-h-6 items-center gap-2 text-xs text-white/45">
        {offline ? <><WifiOff className="h-3.5 w-3.5 text-red-300" /> Conéctate para renovar el QR</> : <><ShieldCheck className="h-3.5 w-3.5 text-stride-cyan" /> Cambia en {seconds} s</>}
      </div>
      {expired && <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 text-xs text-white/60"><RefreshCw className="h-3.5 w-3.5" /> Intentar de nuevo</button>}
    </div>
  );
}
