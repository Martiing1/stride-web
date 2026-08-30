"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallCard() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const listener = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", listener);
    return () => window.removeEventListener("beforeinstallprompt", listener);
  }, []);

  if (installed) return null;

  return (
    <section className="member-panel">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-stride-accent/15 p-2.5 text-stride-cyan"><Download className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading font-bold">Déjalo en tu pantalla de inicio</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/50">Así tu carnet abre como una app y queda siempre a mano.</p>
          {prompt && <button type="button" onClick={async () => { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === "accepted") setInstalled(true); setPrompt(null); }} className="btn-secondary mt-4 px-4 py-2 text-sm"><Download className="h-4 w-4" /> Instalar carnet</button>}
          {!prompt && ios && <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-white/60"><Share className="mt-0.5 h-4 w-4 shrink-0" /> En Safari toca Compartir y luego “Agregar a inicio”.</p>}
        </div>
      </div>
    </section>
  );
}
