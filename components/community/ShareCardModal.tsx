"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, ImageIcon, Instagram, Loader2, Share2, Sticker, Trash2, X } from "lucide-react";
import clsx from "clsx";
import {
  SHARE_FORMATS,
  canCopyImage,
  canShareFiles,
  copyImageToClipboard,
  isMobile,
  openInstagramStoryCamera,
  renderShareCard,
  saveImage,
  type ShareCardData,
  type ShareFormat,
} from "@/lib/share-card";

/**
 * Popup para compartir un logro en Instagram, con el flujo lo más corto
 * posible (pedido de Martín, 2026-09-14, "como Strava"):
 *
 *  - Historia → un botón grande "Subir a mi historia" que abre el menú del
 *    teléfono con la imagen lista; ahí se toca Instagram.
 *  - Sticker  → "Copiar sticker" y, ya copiado, "Abrir mi historia" lleva
 *    directo a la cámara de historias para pegarlo.
 *  - Guardar  → siempre a mano, en ambos formatos.
 *
 * Las dos imágenes se generan APENAS se abre el popup y no al tocar: Safari
 * exige que `navigator.share` y el portapapeles salgan del gesto del dedo, y
 * si primero hay que dibujar el canvas se pierde el permiso.
 */
export function ShareCardModal({ data, onClose }: { data: ShareCardData; onClose: () => void }) {
  const [format, setFormat] = useState<ShareFormat>("story");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [files, setFiles] = useState<Partial<Record<ShareFormat, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<ShareFormat, string>>>({});
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);

  // `data` es un objeto nuevo en cada render del padre: se compara por
  // contenido para no redibujar en loop.
  const dataKey = JSON.stringify({ ...data, photo: undefined });

  useEffect(() => setMobile(isMobile()), []);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    (async () => {
      try {
        const [story, sticker] = await Promise.all([
          renderShareCard({ ...data, photo }, "story"),
          renderShareCard({ ...data, photo: null }, "sticker"),
        ]);
        if (cancelled) return;
        urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        const next = { story: URL.createObjectURL(story), sticker: URL.createObjectURL(sticker) };
        urlsRef.current = [next.story, next.sticker];
        setFiles({ story, sticker });
        setPreviews(next);
      } catch {
        if (!cancelled) setError("No pudimos armar la tarjeta. Intenta de nuevo.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, dataKey]);

  useEffect(() => () => urlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Cambiar de formato limpia los "listo" del otro.
  useEffect(() => {
    setCopied(false);
    setSaved(false);
    setError(null);
  }, [format]);

  const file = files[format] ?? null;
  const preview = previews[format] ?? null;
  const shareable = mobile && canShareFiles(file);

  const ignoreAbort = (err: unknown) => err instanceof Error && err.name === "AbortError";

  /** Historia: el menú del teléfono, con la imagen ya adentro. */
  const shareStory = () => {
    if (!file) return;
    setError(null);
    navigator.share({ files: [file] }).catch((err: unknown) => {
      if (ignoreAbort(err)) return;
      setError("Tu teléfono no dejó abrir el menú de compartir. Guarda la imagen y súbela desde Instagram.");
    });
  };

  /** Sticker: al portapapeles; si el navegador no deja, por el menú de compartir. */
  const copySticker = () => {
    if (!file) return;
    setError(null);
    if (!canCopyImage()) {
      if (shareable) return shareStoryFallback(file);
      setError("Este navegador no deja copiar imágenes. Guarda el sticker y agrégalo desde tu galería.");
      return;
    }
    void copyImageToClipboard(file).then((ok) => {
      if (ok) setCopied(true);
      else if (shareable) shareStoryFallback(file);
      else setError("No pudimos copiar el sticker. Guárdalo y agrégalo desde tu galería.");
    });
  };

  const shareStoryFallback = (target: File) => {
    navigator.share({ files: [target] }).catch((err: unknown) => {
      if (!ignoreAbort(err)) setError("No pudimos copiar el sticker. Guárdalo y agrégalo desde tu galería.");
    });
  };

  const save = () => {
    if (!file) return;
    setError(null);
    saveImage(file)
      .then(() => setSaved(true))
      .catch((err: unknown) => {
        if (!ignoreAbort(err)) setError("No pudimos guardar la imagen. Mantén presionada la vista previa para guardarla.");
      });
  };

  const bigButton = "flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-4 font-heading text-base font-bold transition disabled:opacity-60";
  const smallButton =
    "flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--sline2)] px-4 py-2.5 font-heading text-xs font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)] disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-[97] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="m-rowin flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--sline)] bg-[var(--scard)] sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h3 className="flex items-center gap-2 font-heading text-base font-bold">
            <Instagram className="h-4 w-4" /> Compartir en Instagram
          </h3>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-[var(--sdim)] transition hover:text-[var(--stext)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formato: dos pestañas */}
        <div className="mx-5 grid grid-cols-2 gap-1 rounded-full bg-[var(--scard2)] p-1">
          {SHARE_FORMATS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFormat(option.id)}
              className={clsx(
                "rounded-full py-2 font-heading text-sm font-bold transition",
                format === option.id ? "bg-stride-accent text-white" : "text-[var(--smut)] hover:text-[var(--stext)]"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Vista previa */}
          <div
            className={clsx(
              "relative mx-auto flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl",
              format === "sticker" ? "share-checker p-5" : "bg-[var(--scard2)]"
            )}
          >
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Vista previa de tu tarjeta"
                className={clsx(
                  "w-auto rounded-xl transition-opacity duration-200",
                  format === "sticker" ? "max-h-[26dvh]" : "max-h-[40dvh]",
                  busy && "opacity-40"
                )}
              />
            )}
            {busy && (
              <span className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-semibold text-[var(--smut)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Armando tu tarjeta…
              </span>
            )}
          </div>

          {format === "story" ? (
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
          ) : (
            <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--smut)]">
              Fondo transparente: ponlo encima de tu propio video o foto en la historia.
            </p>
          )}

          {error && <p className="mt-3 text-xs font-semibold text-red-400">{error}</p>}
        </div>

        {/* Acciones */}
        <div className="space-y-2.5 border-t border-[var(--sline)] px-5 pb-5 pt-4">
          {format === "story" ? (
            shareable ? (
              <button type="button" onClick={shareStory} disabled={busy || !file} className={clsx(bigButton, "instagram-cta text-white")}>
                <Instagram className="h-5 w-5" /> Subir a mi historia
              </button>
            ) : (
              <>
                <p className="text-center text-[11px] leading-relaxed text-[var(--smut)]">
                  Desde el computador Instagram no recibe la imagen: guárdala y súbela desde tu celular.
                </p>
                <button type="button" onClick={save} disabled={busy || !file} className={clsx(bigButton, "btn-primary")}>
                  {saved ? <Check className="h-5 w-5" /> : <Download className="h-5 w-5" />} {saved ? "Imagen guardada" : "Guardar imagen"}
                </button>
              </>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={copySticker}
                disabled={busy || !file}
                className={clsx(bigButton, copied ? "border border-emerald-500/40 bg-emerald-500/12 text-emerald-500" : "btn-primary")}
              >
                {copied ? <Check className="h-5 w-5" /> : <Sticker className="h-5 w-5" />}
                {copied ? "Sticker copiado" : "Copiar sticker"}
              </button>
              {copied && mobile && (
                <>
                  <button type="button" onClick={openInstagramStoryCamera} className={clsx(bigButton, "instagram-cta text-white")}>
                    <Instagram className="h-5 w-5" /> Abrir mi historia
                  </button>
                  <p className="text-center text-[11px] leading-relaxed text-[var(--smut)]">
                    En la historia toca <b className="text-[var(--stext)]">Aa</b>, mantén presionado y elige{" "}
                    <b className="text-[var(--stext)]">Pegar</b>: el sticker queda encima.
                  </p>
                </>
              )}
              {copied && !mobile && (
                <p className="text-center text-[11px] leading-relaxed text-[var(--smut)]">
                  Listo en tu portapapeles. Para usarlo en Instagram, hazlo desde el celular.
                </p>
              )}
            </>
          )}

          {/* Guardar siempre a mano (en la historia de escritorio ya es el botón grande) */}
          {(format === "sticker" || shareable) && (
            <div className="flex gap-2">
              <button type="button" onClick={save} disabled={busy || !file} className={smallButton}>
                {saved ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Download className="h-3.5 w-3.5" />}
                {saved ? "Guardada" : format === "sticker" ? "Guardar sticker" : "Guardar imagen"}
              </button>
            </div>
          )}

          {/* Etiquetar no llega a la plataforma: Instagram no le habla a la web. */}
          <p className="text-center text-[11px] leading-relaxed text-[var(--sdim)]">
            Etiqueta a <b className="text-[var(--smut)]">@stridechile</b> y lo compartimos desde nuestra cuenta. Para que cuente en
            el reto, regístralo aquí en la plataforma.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Botón reutilizable que abre el popup. `size="lg"` es el llamado grande de después de registrar. */
export function ShareButton({
  data,
  label = "Compartir",
  variant = "ghost",
  className,
}: {
  data: ShareCardData;
  label?: string;
  variant?: "ghost" | "primary" | "hero";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          variant === "hero"
            ? "instagram-cta flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-4 font-heading text-base font-bold text-white transition"
            : variant === "primary"
              ? "btn-primary px-5 py-2.5 text-sm"
              : "flex items-center gap-2 rounded-full border border-[var(--sline2)] px-4 py-2.5 font-heading text-xs font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]",
          className
        )}
      >
        {variant === "hero" ? <Instagram className="h-5 w-5" /> : <Share2 className={variant === "primary" ? "h-4 w-4" : "h-3.5 w-3.5"} />} {label}
      </button>
      {open && <ShareCardModal data={data} onClose={() => setOpen(false)} />}
    </>
  );
}
