import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MEMBER_CODE_PATTERN } from "./codes";

// Cinco minutos reduce errores al escanear sin perder la protección de un
// código rotativo; cada ventana se firma de forma determinista.
export const QR_TTL_SECONDS = 5 * 60;

/**
 * Margen que se acepta pasada la ventana.
 *
 * Los tokens se alinean a ventanas fijas, no al momento en que el miembro abre
 * el carnet: sin margen, un QR generado al final de una ventana vive segundos y
 * el comercio ve "QR vencido" con una membresía perfectamente vigente. Con el
 * margen todo token sirve entre 5 y 10 minutos, y una captura de pantalla
 * sigue muriendo sola.
 */
export const QR_GRACE_SECONDS = QR_TTL_SECONDS;

interface QrPayload {
  v: 1;
  c: string;
  iat: number;
  exp: number;
}

function signingSecret() {
  const secret = process.env.QR_SIGNING_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Falta QR_SIGNING_SECRET");
  return secret;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", signingSecret()).update(encodedPayload).digest("base64url");
}

/** Un token por ventana de 60 s: no escribe en DB y todos los nodos generan el mismo. */
export function createRotatingQrToken(memberCode: string, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000 / QR_TTL_SECONDS) * QR_TTL_SECONDS;
  const payload: QrPayload = {
    v: 1,
    c: memberCode,
    iat: issuedAt,
    exp: issuedAt + QR_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${encoded}.${sign(encoded)}`, expiresAt: payload.exp * 1000 };
}

export function verifyRotatingQrToken(token: string, now = Date.now()): QrPayload | null {
  const [encoded, receivedSignature, extra] = token.split(".");
  if (!encoded || !receivedSignature || extra) return null;

  const expectedSignature = sign(encoded);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as QrPayload;
    const currentSeconds = Math.floor(now / 1000);
    const validShape =
      payload.v === 1 &&
      typeof payload.c === "string" &&
      MEMBER_CODE_PATTERN.test(payload.c) &&
      Number.isInteger(payload.iat) &&
      Number.isInteger(payload.exp) &&
      payload.exp - payload.iat === QR_TTL_SECONDS;

    if (!validShape || currentSeconds < payload.iat) return null;
    if (currentSeconds >= payload.exp + QR_GRACE_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function rotatingQrUrl(memberCode: string, siteUrl: string, now = Date.now()) {
  const generated = createRotatingQrToken(memberCode, now);
  return {
    ...generated,
    url: `${siteUrl}/validar/qr?t=${encodeURIComponent(generated.token)}`,
  };
}
