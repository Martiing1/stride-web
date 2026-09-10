"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Download, ImageIcon, Instagram, Loader2, Share2, Trash2, X } from "lucide-react";
import clsx from "clsx";
import {
  SHARE_FORMATS,
  canShareFiles,
  renderShareCard,
  shareCaption,
  type ShareCardData,
  type ShareFormat,
} from "@/lib/share-card";

/**
 * Popup para compartir un logro en Instagram, al estilo Strava: se ve la
 * tarjeta antes de mandarla, se puede poner la foto propia de fondo y elegir
 * entre historia, publicación o sticker transparente.
 *
 * La imagen se genera APENAS se abre (y en cada cambio) y no al apretar
 * "Compartir": Safari exige que `navigator.share` salga del gesto del dedo, y
 * si primero hay que dibujar el canvas se pierde el permiso y el share sheet
 * no abre.
 */
export function ShareCardModal({ data, onClose }: { data: ShareCardData; onClose: () => void }) {
  const [format, setFormat] = useState<ShareFormat>("story");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const caption = shareCaption(data);
  const shareable = canShareFiles(file);

  const build = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await renderShareCard({ ...data, photo: format === "sticker" ? null : photo }, format);
      setFile(next);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = URL.createObjectURL(next);
      setPreview(previewRef.current);
    } catch {
      setError("No pudimos armar la tarjeta. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
    // `data` es un objeto nuevo en cada render del padre: se compara por
    // contenido para no redibujar en loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, photo, JSON.stringify({ ...data, photo: undefined })]);

  useEffect(() => {
    void build();
  }, [build]);

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Share sheet del sistema: ahí aparece Instagram (Historia / Publicación). */
  const share = () => {
    if (!file) return;
    setError(null);
    navigator
      .share({ files: [file] })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return; // canceló, no es error
        setError("Tu navegador no dejó abrir el menú de compartir. Descarga la imagen y súbela a Instagram.");
      });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("No pudimos copiar el texto. Puedes seleccionarlo a mano.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[97] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="m-rowin flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--sline)] bg-[var(--scard)] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-[var(--sline)] px-5 py-4">
          <div>
            <h3 className="font-heading text-base font-bold">Compartir</h3>
            <p className="text-xs text-[var(--smut)]">Tu logro, listo para Instagram</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-[var(--sdim)] transition hover:text-[var(--stext)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Vista previa */}
          <div
            className={clsx(
              "relative mx-auto flex min-h-[240px] items-center justify-center overflow-hidden rounded-2xl",
              format === "sticker" ? "share-checker p-4" : "bg-[var(--scard2)]"
            )}
          >
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Vista previa de tu tarjeta"
                className={clsx("max-h-[42dvh] w-auto rounded-xl transition-opacity duration-200", busy && "opacity-40")}
              />
            )}
            {busy && (
              <span className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-semibold text-[var(--smut)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Armando tu tarjeta…
              </span>
            )}
          </div>

          {/* Formato */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {SHARE_FORMATS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFormat(option.id)}
                className={clsx(
                  "rounded-xl border px-2 py-2.5 text-center transition",
                  format === option.id
                    ? "border-stride-accent bg-stride-accent/12 text-[var(--stext)]"
                    : "border-[var(--sline2)] text-[var(--smut)] hover:bg-[var(--shover)]"
                )}
              >
                <span className="block font-heading text-xs font-bold">{option.label}</span>
                <span className="mt-0.5 block text-[10px] leading-tight text-[var(--sdim)]">{option.hint}</span>
              </button>
            ))}
          </div>

          {/* Fondo propio */}
          {format !== "sticker" && (
            <div className="mt-3 flex gap-2">
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--sline2)] py-2.5 text-xs font-semibold text-[var(--smut)] transition hover:border-[var(--stext)] hover:text-[var(--stext)]"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                {photo ? "Cambiar foto de fondo" : "Poner mi foto de fondo"}
              </button>
              {photo && (
                <button
                  type="button"
                  aria-label="Quitar foto"
                  onClick={() => {
                    setPhoto(null);
                    if (photoRef.current) photoRef.current.value = "";
                  }}
                  className="rounded-xl border border-[var(--sline2)] px-3 text-[var(--smut)] transition hover:bg-[var(--shover)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {format === "sticker" && (
            <p className="mt-3 rounded-xl border border-[var(--sline)] bg-[var(--scard2)] px-3.5 py-2.5 text-[11px] leading-relaxed text-[var(--smut)]">
              Fondo transparente: grábate corriendo, sube tu video a la historia y pega esta imagen encima con el sticker de foto.
            </p>
          )}

          {error && <p className="mt-3 text-xs font-semibold text-red-400">{error}</p>}
        </div>

        {/* Acciones */}
        <div className="space-y-2 border-t border-[var(--sline)] px-5 py-4">
          {shareable ? (
            <button
              type="button"
              onClick={share}
              disabled={busy || !file}
              className="btn-primary w-full px-5 py-3 text-sm disabled:opacity-60"
            >
              <Instagram className="h-4 w-4" /> Compartir en Instagram
            </button>
          ) : (
            <p className="rounded-xl border border-[var(--sline)] bg-[var(--scard2)] px-3.5 py-2.5 text-[11px] leading-relaxed text-[var(--smut)]">
              Desde el computador, Instagram no recibe la imagen directo: descárgala y súbela desde el celular. En el
              celular, el botón la manda al Instagram que ya tienes instalado.
            </p>
          )}

          <div className="flex gap-2">
            <a
              href={preview ?? "#"}
              download={file?.name ?? "stride.jpg"}
              className={clsx(
                "flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--sline2)] px-4 py-2.5 font-heading text-xs font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]",
                (busy || !preview) && "pointer-events-none opacity-50"
              )}
            >
              <Download className="h-3.5 w-3.5" /> Descargar
            </a>
            <button
              type="button"
              onClick={copy}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--sline2)] px-4 py-2.5 font-heading text-xs font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Texto copiado" : "Copiar texto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Botón chico y reutilizable que abre el popup. */
export function ShareButton({
  data,
  label = "Compartir",
  variant = "ghost",
  className,
}: {
  data: ShareCardData;
  label?: string;
  variant?: "ghost" | "primary";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          variant === "primary"
            ? "btn-primary px-5 py-2.5 text-sm"
            : "flex items-center gap-2 rounded-full border border-[var(--sline2)] px-4 py-2.5 font-heading text-xs font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]",
          className
        )}
      >
        <Share2 className={variant === "primary" ? "h-4 w-4" : "h-3.5 w-3.5"} /> {label}
      </button>
      {open && <ShareCardModal data={data} onClose={() => setOpen(false)} />}
    </>
  );
}
