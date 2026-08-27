"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * QR de la tarjeta del miembro. Contiene la URL completa de validación, así
 * que la cámara nativa del celular del comercio la abre directamente: no hay
 * app que instalar ni escáner que programar.
 *
 * Fondo blanco y buen margen a propósito — un QR morado sobre negro falla al
 * escanearse con luz mala dentro de un local.
 */
export function MemberQR({ value, disabled = false }: { value: string; disabled?: boolean }) {
  return (
    <div className={`rounded-2xl bg-white p-4 ${disabled ? "opacity-40 grayscale" : ""}`}>
      <QRCodeSVG
        value={value}
        size={200}
        level="M"
        marginSize={2}
        bgColor="#FFFFFF"
        fgColor="#0A0A0A"
      />
    </div>
  );
}
