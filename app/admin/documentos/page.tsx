import { HardDrive } from "lucide-react";
import { requireTeamMember, isStaff } from "@/lib/auth";
import { breadcrumb, driveConfigured, listFolder } from "@/lib/google-drive";
import { DocumentsBrowser } from "@/components/admin/DocumentsBrowser";

export const dynamic = "force-dynamic";

export const metadata = { title: "Documentos" };

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ carpeta?: string }>;
}) {
  const member = await requireTeamMember();
  const { carpeta } = await searchParams;

  if (!driveConfigured()) {
    return (
      <div className="card py-14 text-center text-sm text-white/50">
        Drive no está configurado en este entorno (faltan las credenciales de Google).
      </div>
    );
  }

  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER!;
  let folderId = carpeta && /^[A-Za-z0-9_-]{10,80}$/.test(carpeta) ? carpeta : rootId;

  let trail: Array<{ id: string; name: string }> = [];
  let files;
  try {
    const resolved = folderId === rootId ? [] : await breadcrumb(folderId);
    // Fuera del árbol TEAM STRIDE se vuelve a la raíz, sin reventar.
    if (resolved === null) {
      folderId = rootId;
    } else {
      trail = resolved;
    }
    files = await listFolder(folderId);
  } catch {
    return (
      <div className="card py-14 text-center text-sm text-white/50">
        No pudimos hablar con Google Drive. Recarga en unos segundos.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
          <HardDrive className="h-3.5 w-3.5" /> Documentos
        </p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">TEAM STRIDE</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          El Drive del equipo, sin salir del sistema: actas, planificaciones, rutas y las fotos
          de cada evento. Lo que subas acá queda en el Drive de verdad.
        </p>
      </header>

      <DocumentsBrowser
        folderId={folderId}
        trail={trail}
        files={files}
        canCreateFolders={isStaff(member.role)}
      />
    </div>
  );
}
