import "server-only";
import { inflateRawSync } from "node:zlib";

/**
 * Lector mínimo de .xlsx para el export de inscritos de Evently.
 *
 * Un .xlsx es un ZIP con XML adentro. En vez de arrastrar una librería de
 * planillas completa por un solo archivo conocido, se lee el ZIP a mano
 * (directorio central + deflate) y se extraen las celdas de la primera hoja.
 * Soporta strings inline (lo que produce Evently) y sharedStrings (lo que
 * produce Excel si alguien abre y re-guarda el archivo).
 */

function findEntry(buffer: Buffer, name: string): Buffer | null {
  // End of Central Directory: firma 0x06054b50, buscada desde el final.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i > buffer.length - 22 - 65536; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) return null;

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) return null;
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const entryName = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (entryName === name) {
      const method = buffer.readUInt16LE(offset + 10);
      const compressedSize = buffer.readUInt32LE(offset + 20);
      const localOffset = buffer.readUInt32LE(offset + 42);
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(dataStart, dataStart + compressedSize);
      return method === 8 ? inflateRawSync(data) : Buffer.from(data);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Serial de Excel (días desde 1899-12-30) a ISO. Null si no es número. */
export function excelSerialToIso(value: string): string | null {
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString();
}

/** Devuelve la primera hoja como matriz de strings (fila 0 = encabezados). */
export function readXlsxRows(file: Buffer): string[][] {
  const sheet = findEntry(file, "xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("El archivo no parece un .xlsx válido.");

  const sharedRaw = findEntry(file, "xl/sharedStrings.xml");
  const shared: string[] = [];
  if (sharedRaw) {
    for (const si of sharedRaw.toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(
        decodeXmlEntities(Array.from(si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((m) => m[1]).join(""))
      );
    }
  }

  const xml = sheet.toString("utf8");
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cell of rowMatch[1].matchAll(/<c([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1] ?? "";
      const body = cell[2] ?? "";
      // La letra de columna dice la posición real (hay celdas vacías omitidas).
      const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1];
      let index = cells.length;
      if (ref) {
        index = 0;
        for (const ch of ref) index = index * 26 + (ch.charCodeAt(0) - 64);
        index -= 1;
      }
      while (cells.length < index) cells.push("");

      let value = "";
      const inline = body.match(/<is>([\s\S]*?)<\/is>/);
      const v = body.match(/<v[^>]*>([\s\S]*?)<\/v>/);
      if (inline) {
        value = decodeXmlEntities(Array.from(inline[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((m) => m[1]).join(""));
      } else if (v) {
        value = /t="s"/.test(attrs) ? shared[Number(v[1])] ?? "" : decodeXmlEntities(v[1]);
      }
      cells[index] = value;
    }
    rows.push(cells);
  }
  return rows;
}
