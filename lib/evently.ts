import "server-only";

/**
 * Lector de metadatos de un evento publicado en Evently.
 *
 * Evently incrusta el evento como JSON-LD (schema.org/Event), a veces directo
 * en un <script type="application/ld+json"> y a veces escapado dentro del
 * payload de Next (self.__next_f.push). Se intentan ambos y, si no aparece,
 * se cae a las etiquetas OG. Cupos y punto de partida exacto no existen en la
 * página: eso queda manual a propósito.
 */

export interface EventlyEvent {
  title: string | null;
  /** YYYY-MM-DD en hora de Chile. */
  eventDate: string | null;
  /** HH:MM en hora de Chile. */
  eventTime: string | null;
  meetingPoint: string | null;
  description: string | null;
  imageUrl: string | null;
}

interface LdEvent {
  "@type"?: string;
  name?: string;
  startDate?: string;
  description?: string;
  image?: string[] | string;
  location?: { name?: string };
}

function inChile(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", ...options }).format(new Date(iso));
}

/** Busca un objeto JSON balanceado que empiece en `start`. */
function balancedJson(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function findLdEvent(text: string): LdEvent | null {
  let cursor = 0;
  while (true) {
    const marker = text.indexOf('"@type":"Event"', cursor);
    if (marker === -1) return null;
    const start = text.lastIndexOf("{", marker);
    if (start !== -1) {
      const candidate = balancedJson(text, start);
      if (candidate) {
        try {
          const parsed = JSON.parse(candidate) as LdEvent;
          if (parsed["@type"] === "Event") return parsed;
        } catch {}
      }
    }
    cursor = marker + 1;
  }
}

export async function fetchEventlyEvent(rawUrl: string): Promise<EventlyEvent | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  // Solo Evently: esta función descarga lo que le pidan, así que se acota.
  if (url.protocol !== "https:" || !/(^|\.)evently\.cl$/.test(url.hostname)) return null;

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; StrideERP/1.0)" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const html = await response.text();

  // 1) JSON-LD directo. 2) Escapado en el payload de Next.
  let event: LdEvent | null = null;
  for (const match of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    event = findLdEvent(match[1]);
    if (event) break;
  }
  if (!event) {
    const chunks = Array.from(html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g));
    const blob = chunks
      .map((m) => {
        try {
          return JSON.parse(`"${m[1]}"`) as string;
        } catch {
          return m[1];
        }
      })
      .join("");
    event = findLdEvent(blob);
  }

  const og = (property: string) =>
    html.match(new RegExp(`<meta property="og:${property}" content="([^"]*)"`))?.[1] ?? null;

  const title = event?.name ?? og("title")?.replace(/\s*\|\s*Evently\s*$/, "").split(" - ")[0] ?? null;
  const image = Array.isArray(event?.image) ? event?.image[0] ?? null : event?.image ?? og("image");

  return {
    title,
    eventDate: event?.startDate ? inChile(event.startDate, { year: "numeric", month: "2-digit", day: "2-digit" }) : null,
    eventTime: event?.startDate ? inChile(event.startDate, { hour: "2-digit", minute: "2-digit", hour12: false }) : null,
    meetingPoint: event?.location?.name ?? null,
    description: event?.description ?? og("description"),
    imageUrl: image ?? null,
  };
}
