"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  File as FileIcon, FileImage, FileSpreadsheet, FileText, FileVideo, Folder, FolderPlus,
  ExternalLink, ChevronRight, HardDrive,
} from "lucide-react";
import { createDriveFolder } from "@/app/admin/documentos/actions";
import { DriveUploader, formatSize } from "@/components/admin/DriveUploader";
import type { DriveFile } from "@/lib/google-drive";

function iconFor(file: DriveFile) {
  if (file.isFolder) return Folder;
  const m = file.mimeType;
  if (m.startsWith("image/")) return FileImage;
  if (m.startsWith("video/")) return FileVideo;
  if (m.includes("spreadsheet") || m.includes("excel") || m.includes("csv")) return FileSpreadsheet;
  if (m.includes("document") || m.includes("pdf") || m.includes("text")) return FileText;
  return FileIcon;
}

/** Explorador del Drive TEAM STRIDE dentro del ERP. */
export function DocumentsBrowser({
  folderId,
  trail,
  files,
  canCreateFolders,
}: {
  folderId: string;
  trail: Array<{ id: string; name: string }>;
  files: DriveFile[];
  canCreateFolders: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function newFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("parent_id", folderId);
    setMessage(null);
    startTransition(async () => {
      const result = await createDriveFolder(form);
      if (result.ok) setCreating(false);
      else setMessage(result.error ?? "Error");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Migas de pan + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Ruta">
          <Link href="/admin/documentos" className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 ${trail.length === 0 ? "font-semibold text-white" : "text-white/50 hover:text-white"}`}>
            <HardDrive className="h-4 w-4" /> TEAM STRIDE
          </Link>
          {trail.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-white/25" />
              <Link href={`/admin/documentos?carpeta=${crumb.id}`} className={`rounded-lg px-2 py-1 ${i === trail.length - 1 ? "font-semibold text-white" : "text-white/50 hover:text-white"}`}>
                {crumb.name}
              </Link>
            </span>
          ))}
        </nav>

        {canCreateFolders && !creating && (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:text-white">
            <FolderPlus className="h-4 w-4" /> Carpeta
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={newFolder} className="card flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="name" className="label">Nombre de la carpeta</label>
            <input id="name" name="name" required autoFocus className="input" placeholder="Fotos social run 06-09" />
          </div>
          <button type="submit" disabled={pending} className="btn-primary">Crear</button>
          <button type="button" onClick={() => setCreating(false)} className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/60">Cancelar</button>
        </form>
      )}

      {message && (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{message}</p>
      )}

      {/* Subida masiva a la carpeta abierta */}
      <DriveUploader folderId={folderId} onUploaded={() => router.refresh()} />

      {/* Listado */}
      {files.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <Folder className="h-10 w-10 text-white/25" />
          <p className="text-sm text-white/50">Carpeta vacía. Sube los primeros archivos.</p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => {
            const Icon = iconFor(file);
            const inner = (
              <>
                <Icon className={`h-5 w-5 shrink-0 ${file.isFolder ? "text-stride-cyan" : "text-white/40"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">{file.name}</span>
                  <span className="block text-[11px] text-white/35">
                    {file.isFolder ? "Carpeta" : formatSize(file.size)}
                    {file.modifiedTime && ` · ${new Date(file.modifiedTime).toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}`}
                  </span>
                </span>
              </>
            );
            return (
              <li key={file.id}>
                {file.isFolder ? (
                  <Link href={`/admin/documentos?carpeta=${file.id}`} className="flex items-center gap-3 rounded-xl border border-white/5 bg-stride-card p-3 transition hover:border-white/20">
                    {inner}
                  </Link>
                ) : (
                  <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-white/5 bg-stride-card p-3 transition hover:border-white/20">
                    {inner}
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/25" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
