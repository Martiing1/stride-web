import { randomBytes } from "node:crypto";

// Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para que un código se pueda
// dictar por teléfono o escribir a mano sin errores.
const READABLE = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomFrom(alphabet: string, length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/**
 * Código público del miembro. Va dentro del QR y viaja en la URL de
 * validación, así que se asume visible para cualquiera.
 * Ej: STR-7K4M2P
 */
export function generateMemberCode(): string {
  return `STR-${randomFrom(READABLE, 6)}`;
}

/**
 * Token privado de la tarjeta virtual (stridechile.cl/tarjeta/<token>).
 * Es el secreto que le da acceso al miembro a su propia tarjeta: 32 caracteres
 * hex (128 bits) para que no se pueda adivinar por fuerza bruta.
 */
export function generateCardToken(): string {
  return randomBytes(16).toString("hex");
}
