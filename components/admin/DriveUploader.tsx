"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { CheckCircle2, Loader2, RotateCcw, UploadCloud, XCircle } from "lucide-react";
import { startDocumentUploads } from "@/app/admin/documentos/actions";

type Status = "pendiente" | "subiendo" | "listo" | "error";

interface Item {
  key: string;
  file: File;
  progress: number;
  status: Status;
}

/** Sesiones pedidas por llamada al servidor (tope de la acción). */
const SESSION_BATCH = 50;
/** Archivos subiendo a la vez: más satura el celular sin ganar velocidad. */
const PARALLEL = 3;

export function formatSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const mimeOf = (file: File) => file.type || "application/octet-stream";

/** PUT directo a la sesión reanudable de Google, con progreso. */
function putFile(url: string, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mimeOf(file));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error("red"));
    xhr.send(file);
  });
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    })
  );
}

/**
 * Subida masiva a una carpeta del Drive TEAM STRIDE: se eligen o arrastran
 * varios archivos de una y cada uno viaja directo del navegador a Google.
 */
export function DriveUploader({
  folderId,
  onUploaded,
  compact = false,
}: {
  folderId: string;
  onUploaded?: () => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cerrar la pestaña a mitad de subida corta los archivos en curso.
  useEffect(() => {
    if (active === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);

  const patch = (key: string, changes: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...changes } : it)));

  async function upload(batch: Item[]) {
    setActive((n) => n + 1);
    setError(null);
    try {
      for (let start = 0; start < batch.length; start += SESSION_BATCH) {
        const chunk = batch.slice(start, start + SESSION_BATCH);
        const result = await startDocumentUploads(
          folderId,
          chunk.map((it) => ({ name: it.file.name, type: mimeOf(it.file), size: it.file.size }))
        ).catch(() => ({ ok: false, error: "Se cortó la conexión.", urls: undefined }));
        if (!result.ok || !result.urls) {
          setError(result.error ?? "No se pudo preparar la subida.");
          chunk.forEach((it) => patch(it.key, { status: "error" }));
          continue;
        }
        const urls = result.urls;
        await runPool(chunk.map((it, i) => ({ it, url: urls[i] })), PARALLEL, async ({ it, url }) => {
          patch(it.key, { status: "subiendo", progress: 0 });
          try {
            await putFile(url, it.file, (progress) => patch(it.key, { progress }));
            patch(it.key, { status: "listo", progress: 1 });
          } catch {
            patch(it.key, { status: "error" });
          }
        });
      }
    } finally {
      setActive((n) => n - 1);
      onUploaded?.();
      // El listado de Drive tarda unos segundos en mostrar lo recién subido:
      // sin este segundo refresco la carpeta seguía "vacía" hasta recargar.
      window.setTimeout(() => onUploaded?.(), 3000);
    }
  }

  function add(list: FileList | null) {
    const fresh: Item[] = Array.from(list ?? [])
      .filter((file) => file.size > 0)
      .map((file) => ({ key: crypto.randomUUID(), file, progress: 0, status: "pendiente" }));
    if (inputRef.current) inputRef.current.value = "";
    if (!fresh.length) return;
    // Lo ya subido de tandas anteriores sale de la lista; lo fallido se queda para reintentar.
    setItems((prev) => [...prev.filter((it) => it.status !== "listo"), ...fresh]);
    void upload(fresh);
  }

  function retry() {
    const failed = items.filter((it) => it.status === "error");
    failed.forEach((it) => patch(it.key, { status: "pendiente", progress: 0 }));
    void upload(failed);
  }

  function drop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    add(e.dataTransfer.files);
  }

  const done = items.filter((it) => it.status === "listo").length;
  const failed = items.filter((it) => it.status === "error").length;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={`flex flex-col items-center rounded-xl border border-dashed text-center transition ${compact ? "p-4" : "p-6"} ${dragging ? "border-stride-accent bg-stride-accent/10" : "border-white/15"}`}
      >
        <UploadCloud className={`${compact ? "h-6 w-6" : "h-8 w-8"} text-white/35`} />
        <p className="mt-2 text-sm text-white/70">Arrastra aquí los archivos o</p>
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary mt-3 px-5 py-2 text-sm">
          Elegir archivos
        </button>
        <p className="mt-2 text-[11px] text-white/35">Puedes elegir varios a la vez, del peso que sean.</p>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => add(e.target.files)} />
      </div>

      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-white/50">
            <span>
              {done} de {items.length} subidos{failed > 0 && ` · ${failed} con error`}
            </span>
            {failed > 0 && active === 0 && (
              <button type="button" onClick={retry} className="inline-flex items-center gap-1 font-semibold text-white/70 hover:text-white">
                <RotateCcw className="h-3.5 w-3.5" /> Reintentar
              </button>
            )}
          </div>
          <ul className={`space-y-1.5 overflow-y-auto pr-1 ${compact ? "max-h-48" : "max-h-72"}`}>
            {items.map((it) => (
              <li key={it.key} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  {it.status === "listo" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : it.status === "error" ? (
                    <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                  ) : (
                    <Loader2 className={`h-4 w-4 shrink-0 text-white/35 ${it.status === "subiendo" ? "animate-spin" : ""}`} />
                  )}
                  <span className="min-w-0 flex-1 truncate text-white/80">{it.file.name}</span>
                  <span className="shrink-0 text-white/35">
                    {it.status === "subiendo" ? `${Math.round(it.progress * 100)}%` : formatSize(it.file.size)}
                  </span>
                </div>
                {it.status === "subiendo" && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-stride-accent transition-[width]" style={{ width: `${Math.round(it.progress * 100)}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
