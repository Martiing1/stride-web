/**
 * Detección de tipo real de archivo por magic bytes (no por extensión).
 * Compartido por las subidas de la comunidad; mismo criterio que la foto
 * de carnet en app/miembros/actions.ts.
 */
export function detectImage(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: "image/jpeg", extension: "jpg" };
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v)
  )
    return { mime: "image/png", extension: "png" };
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  )
    return { mime: "image/webp", extension: "webp" };
  return null;
}

export function detectVideo(bytes: Uint8Array): { mime: string; extension: string } | null {
  // MP4/MOV: caja "ftyp" en el offset 4.
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp") {
    const brand = new TextDecoder().decode(bytes.slice(8, 12));
    if (brand.startsWith("qt")) return { mime: "video/quicktime", extension: "mov" };
    return { mime: "video/mp4", extension: "mp4" };
  }
  return null;
}
