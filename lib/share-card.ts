/**
 * Tarjeta para compartir un logro en Instagram.
 *
 * Cómo se comparte de verdad desde la web: Instagram NO deja publicar en
 * historias desde un sitio (el esquema `instagram-stories://` solo funciona
 * desde apps nativas con App ID de Meta). Lo que sí funciona en celular es lo
 * que hacen Strava y compañía: la app arma la imagen y la entrega al share
 * sheet del sistema con `navigator.share({ files })`; ahí aparece Instagram y
 * la persona elige Historia o Publicación. Por eso acá se dibuja la imagen
 * completa en un canvas y se devuelve como archivo.
 *
 * Diseño (aprobado por Martín, 2026-09-10): sobrio, calcado del share de
 * Strava. Un solo bloque centrado — título, filete de marca, cifras en fila
 * con la etiqueta encima del número, logo — sobre la foto de la persona o
 * sobre negro. Sin emojis, sin cápsulas, sin degradados de fondo. La única
 * concesión al premio: la cifra de la medalla va en oro, plata o bronce.
 *
 * Formatos que ofrece la app (2026-09-14, Martín sacó la publicación):
 *  - `story`   1080x1920, para la historia.
 *  - `sticker` PNG con fondo TRANSPARENTE y alto variable: el mismo bloque
 *              suelto, para copiarlo y pegarlo encima del video propio.
 * `post` (1080x1350) sigue dibujándose si alguien lo pide, pero no se ofrece.
 *
 * Guardrail de marca: acá NUNCA se muestran ritmo ni velocidad. Las cifras son
 * de constancia y participación (avance, puntos, medallas).
 *
 * Solo cliente: usa canvas, document.fonts y URL.createObjectURL.
 */

export type ShareFormat = "story" | "post" | "sticker";
export type MedalRarity = "oro" | "plata" | "bronce";

export interface ShareStat {
  /** Va encima del número, en texto normal: "Avance", "Puntos", "Medalla". */
  label: string;
  value: string;
  /** La cifra se pinta con el color de la medalla (oro/plata/bronce). */
  tint?: boolean;
}

export interface ShareCardData {
  title: string;
  /** Máximo 3; se recortan solas si vienen más. */
  stats: ShareStat[];
  /** Rareza de la medalla: define el color de las cifras marcadas con `tint`. */
  medal?: MedalRarity | null;
  /** Solo para el texto sugerido ("Reto cumplido", "Nueva medalla"…). No se dibuja. */
  headline?: string;
  /** Foto de fondo elegida por la persona (no aplica al sticker). */
  photo?: Blob | null;
}

export const SHARE_FORMATS: Array<{ id: ShareFormat; label: string; hint: string }> = [
  { id: "story", label: "Historia", hint: "Pantalla completa" },
  { id: "sticker", label: "Sticker", hint: "Para pegar sobre tu video" },
];

const INK = "#0A0A0A";
const CYAN = "#00E5FF";
const INDIGO = "#6366F1";
const ACCENT = "#7C3AED";

const LOGO_SRC = "/stride_logo_clean.png";
const LOGO_RATIO = 1200 / 414;

/** Metales de las medallas, de la luz a la sombra. */
export const MEDAL_STOPS: Record<MedalRarity, [string, string, string]> = {
  oro: ["#FFE49B", "#E8B23C", "#B87914"],
  plata: ["#F5F8FB", "#CBD5E1", "#8E9BAA"],
  bronce: ["#F3C69C", "#C97B3C", "#8C4E1A"],
};

// ─── Utilidades ──────────────────────────────────────────────────────────────

/** Familia tipográfica real que inyecta next/font (variable CSS en <html>). */
function family(cssVar: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

const HEAD = () => family("--font-outfit", "Inter, system-ui, sans-serif");
const BODY = () => family("--font-inter", "system-ui, sans-serif");

/** El canvas dibuja con la fuente ya cargada o cae al fallback sin avisar. */
async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  const head = HEAD();
  const body = BODY();
  await Promise.all(
    [`600 70px ${head}`, `500 40px ${body}`, `500 30px ${body}`].map((font) =>
      document.fonts.load(font).catch(() => undefined)
    )
  );
  await document.fonts.ready.catch(() => undefined);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // sin logo se sigue igual
    img.src = src;
  });
}

/** Decodifica respetando la orientación EXIF (las fotos de celular vienen giradas). */
async function decodeBlob(blob: Blob): Promise<CanvasImageSource | null> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch {
      /* Safari viejo: se cae al <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  const img = await loadImage(url);
  URL.revokeObjectURL(url);
  return img;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Baja el tamaño hasta que el texto entre en el ancho y en las líneas dadas. */
function fit(
  ctx: CanvasRenderingContext2D,
  text: string,
  { maxWidth, maxLines, max, min, font }: { maxWidth: number; maxLines: number; max: number; min: number; font: string }
) {
  let size = max;
  let lines: string[] = [];
  for (; size >= min; size -= 2) {
    ctx.font = `500 ${size}px ${font}`;
    lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines) break;
  }
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "…");
  }
  return { lines, size: Math.max(size, min) };
}

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number) {
  const iw = Number((img as HTMLImageElement).width);
  const ih = Number((img as HTMLImageElement).height);
  const scale = Math.max(w / iw, h / ih);
  // Encuadre un poco sobre el centro: en las fotos de running la gente casi
  // siempre queda arriba del medio.
  ctx.drawImage(img, (w - iw * scale) / 2, (h - ih * scale) * 0.3, iw * scale, ih * scale);
}

/** Velo suave y sin costuras: sube de a poco en vez de en línea recta. */
function scrim(ctx: CanvasRenderingContext2D, w: number, from: number, to: number, alpha: number) {
  const g = ctx.createLinearGradient(0, from, 0, to);
  g.addColorStop(0, "rgba(10,10,10,0)");
  g.addColorStop(0.35, `rgba(10,10,10,${alpha * 0.3})`);
  g.addColorStop(0.7, `rgba(10,10,10,${alpha * 0.75})`);
  g.addColorStop(1, `rgba(10,10,10,${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.min(from, to), w, Math.abs(to - from));
}

/** Degradado de marca (cian → índigo → morado). */
function brand(ctx: CanvasRenderingContext2D, x0: number, x1: number) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, CYAN);
  g.addColorStop(0.55, INDIGO);
  g.addColorStop(1, ACCENT);
  return g;
}

function metal(ctx: CanvasRenderingContext2D, rarity: MedalRarity, x0: number, x1: number) {
  const [a, b, c] = MEDAL_STOPS[rarity];
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, a);
  g.addColorStop(0.5, b);
  g.addColorStop(1, c);
  return g;
}

// ─── El bloque ───────────────────────────────────────────────────────────────

interface BlockMetrics {
  title: { lines: string[]; size: number; lineH: number };
  labelSize: number;
  valueSize: number;
  cols: number[];
  colGap: number;
  statsH: number;
  ruleGap: [number, number];
  logoW: number;
  logoH: number;
  logoGap: number;
  height: number;
}

/** Mide el bloque (título · filete · cifras · logo) para un ancho y escala dados. */
function measureBlock(ctx: CanvasRenderingContext2D, data: ShareCardData, inner: number, scale: number): BlockMetrics {
  const title = fit(ctx, data.title, {
    maxWidth: inner,
    maxLines: 2,
    max: Math.round(40 * scale),
    min: Math.round(30 * scale),
    font: BODY(),
  });
  const lineH = Math.round(title.size * 1.34);

  const labelSize = Math.round(30 * scale);
  let valueSize = Math.round(70 * scale);
  const colGap = Math.round(72 * scale);
  const stats = data.stats.slice(0, 3);
  const measureCols = () =>
    stats.map((s) => {
      ctx.font = `500 ${labelSize}px ${BODY()}`;
      const l = ctx.measureText(s.label).width;
      ctx.font = `600 ${valueSize}px ${HEAD()}`;
      return Math.max(l, ctx.measureText(s.value).width);
    });
  let cols = measureCols();
  const rowW = () => cols.reduce((a, b) => a + b, 0) + colGap * Math.max(0, stats.length - 1);
  while (rowW() > inner && valueSize > Math.round(40 * scale)) {
    valueSize -= 2;
    cols = measureCols();
  }
  const statsH = stats.length ? labelSize + Math.round(10 * scale) + valueSize : 0;

  const ruleGap: [number, number] = [Math.round(36 * scale), Math.round(34 * scale)];
  const logoW = Math.round(176 * scale);
  const logoH = logoW / LOGO_RATIO;
  const logoGap = Math.round(52 * scale);

  const height =
    lineH * title.lines.length +
    ruleGap[0] +
    Math.round(5 * scale) +
    ruleGap[1] +
    statsH +
    (stats.length ? logoGap : Math.round(30 * scale)) +
    logoH;

  return { title: { ...title, lineH }, labelSize, valueSize, cols, colGap, statsH, ruleGap, logoW, logoH, logoGap, height };
}

/** Dibuja el bloque medido, centrado en `cx`, empezando en `top`. */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  m: BlockMetrics,
  cx: number,
  top: number,
  scale: number,
  logo: HTMLImageElement | null
) {
  const stats = data.stats.slice(0, 3);
  let y = top;

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  // Sombra suave: sobre foto sostiene el texto; sobre negro no se nota.
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = Math.round(22 * scale);
  ctx.shadowOffsetY = 2;

  ctx.font = `500 ${m.title.size}px ${BODY()}`;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  for (const line of m.title.lines) {
    ctx.fillText(line, cx, y);
    y += m.title.lineH;
  }
  y += m.ruleGap[0];

  // Filete: siempre de marca. La medalla vive en su cifra, no acá.
  const ruleW = Math.round(120 * scale);
  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = brand(ctx, cx - ruleW / 2, cx + ruleW / 2);
  ctx.fillRect(cx - ruleW / 2, y, ruleW, Math.round(5 * scale));
  ctx.restore();
  y += Math.round(5 * scale) + m.ruleGap[1];

  if (stats.length) {
    const rowW = m.cols.reduce((a, b) => a + b, 0) + m.colGap * (stats.length - 1);
    let cursor = cx - rowW / 2;
    stats.forEach((stat, i) => {
      const colCx = cursor + m.cols[i] / 2;
      ctx.font = `500 ${m.labelSize}px ${BODY()}`;
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(stat.label, colCx, y);

      ctx.font = `600 ${m.valueSize}px ${HEAD()}`;
      ctx.fillStyle =
        stat.tint && data.medal ? metal(ctx, data.medal, colCx - m.cols[i] / 2, colCx + m.cols[i] / 2) : "#FFFFFF";
      ctx.fillText(stat.value, colCx, y + m.labelSize + Math.round(10 * scale));
      cursor += m.cols[i] + m.colGap;
    });
    y += m.statsH + m.logoGap;
  } else {
    y += Math.round(30 * scale);
  }

  if (logo) {
    // Centrado al ojo, no al píxel: la palabra "stride" carga el peso a la
    // derecha y centrada matemáticamente se lee corrida (aprobado por Martín).
    const nudge = -Math.round(m.logoW * 0.05);
    ctx.drawImage(logo, cx - m.logoW / 2 + nudge, y, m.logoW, m.logoH);
  }

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// ─── Formatos ────────────────────────────────────────────────────────────────

async function drawFull(canvas: HTMLCanvasElement, data: ShareCardData, format: "story" | "post") {
  const W = 1080;
  const H = format === "story" ? 1920 : 1350;
  const scale = format === "story" ? 1 : 0.92;
  const pad = Math.round(80 * scale);
  const inner = W - pad * 2;

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const [logo, photo] = await Promise.all([
    loadImage(LOGO_SRC),
    data.photo ? decodeBlob(data.photo) : Promise.resolve(null),
  ]);

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  if (photo) {
    drawCover(ctx, photo, W, H);
    scrim(ctx, W, H * 0.3, 0, 0.32);
    scrim(ctx, W, H * 0.38, H, 0.86);
  } else {
    // Sin foto: negro con una insinuación de luz. La marca la pone el logo.
    const light = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, H * 0.8);
    light.addColorStop(0, "rgba(255,255,255,0.06)");
    light.addColorStop(1, "rgba(10,10,10,0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, W, H);
  }

  const m = measureBlock(ctx, data, inner, scale);
  // Con foto el bloque baja para no taparle la cara a nadie; sin foto se
  // centra y el aire alrededor es intencional.
  const top = photo ? H - Math.round(206 * scale) - m.height : Math.round((H - m.height) / 2);
  drawBlock(ctx, data, m, W / 2, top, scale, logo);
}

/** Sticker: el bloque suelto sobre transparente, con más sombra porque va sobre video. */
async function drawSticker(canvas: HTMLCanvasElement, data: ShareCardData) {
  const W = 1080;
  const pad = 60;
  const inner = W - pad * 2;
  const measure = document.createElement("canvas").getContext("2d")!;
  const m = measureBlock(measure, data, inner, 1);
  const margin = 48; // aire para la sombra

  canvas.width = W;
  canvas.height = Math.round(m.height + margin * 2);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const logo = await loadImage(LOGO_SRC);
  // Se dibuja dos veces: la primera solo aporta sombra ancha para despegar
  // el texto de cualquier video; la segunda es la nítida.
  ctx.save();
  ctx.globalAlpha = 0.85;
  drawBlock(ctx, data, m, W / 2, margin, 1, logo);
  ctx.restore();
  drawBlock(ctx, data, m, W / 2, margin, 1, logo);
}

// ─── API ─────────────────────────────────────────────────────────────────────

/** Dibuja la tarjeta y la devuelve como archivo listo para el share sheet. */
export async function renderShareCard(data: ShareCardData, format: ShareFormat): Promise<File> {
  await ensureFonts();
  const canvas = document.createElement("canvas");
  if (format === "sticker") await drawSticker(canvas, data);
  else await drawFull(canvas, data, format);

  // El sticker necesita PNG por la transparencia; con foto, JPEG pesa mucho
  // menos y el share sheet responde más rápido.
  const type = format === "sticker" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
  if (!blob) throw new Error("No pudimos generar la imagen.");
  return new File([blob], `stride-${format}.${type === "image/png" ? "png" : "jpg"}`, { type });
}

/** Si el navegador puede mandar archivos al share sheet del sistema. */
export function canShareFiles(file?: File | null): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare || !navigator.share) return false;
  try {
    return file ? navigator.canShare({ files: [file] }) : true;
  } catch {
    return false;
  }
}

/** Pluraliza la unidad del reto para la etiqueta de la cifra ("foto" → "Fotos"). */
export function unitLabel(unit: string | null | undefined, fallback = "Avance"): string {
  const u = (unit ?? "").trim().toLowerCase();
  if (!u) return fallback;
  if (u.length <= 3) return u.toUpperCase(); // km, min…
  let plural: string;
  if (/ión$/.test(u)) plural = u.replace(/ión$/, "iones");
  else if (/[aeiouáéíóú]$/.test(u)) plural = `${u}s`;
  else if (/[sx]$/.test(u)) plural = u;
  else plural = `${u}es`;
  return plural.charAt(0).toUpperCase() + plural.slice(1);
}

// ─── Mandar a Instagram ──────────────────────────────────────────────────────
//
// Strava abre la historia de Instagram con la imagen ya puesta porque es una
// app nativa con App ID de Meta. Una web no puede: ni el pasteboard especial
// de iOS ni el intent de Android aceptan archivos desde el navegador. Lo más
// cerca que se llega es esto: la historia sale en UN toque hacia el menú del
// teléfono (donde está Instagram), y el sticker se copia en un toque y se
// abre la cámara de historias en otro, lista para pegarlo.

/** iPhone o iPad (el iPad moderno dice "Macintosh" pero tiene pantalla táctil). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/** Celular o tablet: donde está instalado Instagram. */
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return isIOS() || /Android/i.test(navigator.userAgent);
}

/** Si el navegador deja copiar una imagen al portapapeles. */
export function canCopyImage(): boolean {
  return typeof window !== "undefined" && "ClipboardItem" in window && !!navigator.clipboard?.write;
}

/**
 * Copia el PNG al portapapeles. Llamar directo desde el toque: Safari exige
 * que la escritura salga del gesto, por eso el archivo ya tiene que existir.
 */
export async function copyImageToClipboard(file: File): Promise<boolean> {
  if (!canCopyImage()) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]);
    return true;
  } catch {
    return false;
  }
}

/** Abre la cámara de historias de Instagram (si la app está instalada). */
export function openInstagramStoryCamera(): void {
  window.location.href = /Android/i.test(navigator.userAgent)
    ? "intent://story-camera#Intent;package=com.instagram.android;scheme=instagram;end"
    : "instagram://story-camera";
}

/**
 * Guarda la imagen. En iPhone el único camino a Fotos es el menú de compartir
 * ("Guardar imagen"); en Android y computador se descarga.
 */
export async function saveImage(file: File): Promise<void> {
  if (isIOS() && canShareFiles(file)) {
    await navigator.share({ files: [file] });
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
