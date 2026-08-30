import { Suspense } from "react";
import { AuthHashSession } from "@/components/AuthHashSession";

export const metadata = {
  title: "Entrando…",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Cierra el flujo implícito: los enlaces que envía Supabase desde el servidor
 * traen la sesión en el fragmento (`#access_token=…`), que nunca viaja al
 * servidor. Esta pantalla existe solo para leerlo desde el navegador.
 */
export default function AuthLinkPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-stride-bg px-5 py-10">
      <Suspense fallback={null}>
        <AuthHashSession />
      </Suspense>
    </main>
  );
}
