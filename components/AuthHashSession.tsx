"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Lee la sesión del fragmento de la URL y la guarda en cookies. */
export function AuthHashSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const requestedNext = searchParams.get("next");
    const next =
      requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
        ? requestedNext
        : "/miembros";

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const hashError = hash.get("error_code") ?? hash.get("error");

    if (hashError) {
      const reason = hashError.includes("expired") ? "vencido" : "enlace";
      router.replace(`/miembros/ingresar?error=${reason}`);
      return;
    }

    if (!accessToken || !refreshToken) {
      router.replace("/miembros/ingresar?error=enlace");
      return;
    }

    void (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setFailed(true);
        router.replace("/miembros/ingresar?error=vencido");
        return;
      }

      // Deja la URL limpia: el fragmento trae tokens y no debe quedar en el historial.
      window.history.replaceState(null, "", window.location.pathname);
      router.replace(next);
      router.refresh();
    })();
  }, [router, searchParams]);

  if (failed) return null;

  return (
    <p className="flex items-center gap-3 text-sm text-white/50">
      <Loader2 className="h-4 w-4 animate-spin" /> Validando tu acceso…
    </p>
  );
}
