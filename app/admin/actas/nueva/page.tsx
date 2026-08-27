import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { ActaUploader } from "@/components/admin/ActaUploader";

export const dynamic = "force-dynamic";

export default async function NuevaActaPage() {
  await requireTeamMember(["socio", "lider_comunidad"]);

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/actas"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Actas
        </Link>
        <h1 className="font-heading text-3xl font-extrabold text-white">Subir acta</h1>
        <p className="mt-1 max-w-2xl text-white/50">
          Pega el acta completa tal como te la devolvió la IA. Si trae el bloque AUTO_PROCESSING, a
          la derecha vas a ver exactamente qué tareas se van a crear antes de guardar.
        </p>
      </header>

      <ActaUploader />
    </div>
  );
}
