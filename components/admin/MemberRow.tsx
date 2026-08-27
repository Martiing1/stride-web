"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, QrCode, RefreshCw, MessageCircle, ChevronDown } from "lucide-react";
import { setMemberStatus, regenerateCardToken } from "@/app/admin/miembros/actions";
import type { Member } from "@/lib/types";

/**
 * Fila de miembro con su tarjeta desplegable: QR, link privado para enviarle
 * por WhatsApp y control de estado.
 */
export function MemberRow({
  member,
  valid,
  cardUrl,
  validateUrl,
  validUntilLabel,
}: {
  member: Member;
  valid: boolean;
  cardUrl: string;
  validateUrl: string;
  validUntilLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copyCardUrl() {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // El portapapeles puede estar bloqueado: el link igual se ve en pantalla
      // y se puede seleccionar a mano.
    }
  }

  async function changeStatus(status: Member["status"]) {
    setBusy(true);
    const form = new FormData();
    form.set("id", member.id);
    form.set("status", status);
    await setMemberStatus(form);
    setBusy(false);
    router.refresh();
  }

  async function rotateToken() {
    if (!confirm("El link actual dejará de funcionar y habrá que reenviarle el nuevo. ¿Seguir?")) {
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.set("id", member.id);
    await regenerateCardToken(form);
    setBusy(false);
    router.refresh();
  }

  const waLink = member.whatsapp
    ? `https://wa.me/${member.whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `¡Bienvenido a STRIDE ONE, ${member.full_name.split(" ")[0]}! Esta es tu tarjeta digital: ${cardUrl}\n\nGuárdala en la pantalla de inicio de tu celular y muéstrala en los locales con convenio.`
      )}`
    : null;

  return (
    <div className="card p-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-4 text-left"
      >
        {member.photo_url ? (
          <Image
            src={member.photo_url}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 font-heading font-bold text-white/50">
            {member.full_name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{member.full_name}</p>
          <p className="truncate text-xs text-white/40">
            <span className="font-mono">{member.member_code}</span> · vence {validUntilLabel}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            valid ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
          }`}
        >
          {valid ? "Vigente" : member.status}
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/30 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="grid gap-6 border-t border-white/5 p-5 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG value={validateUrl} size={120} level="M" marginSize={1} fgColor="#0A0A0A" />
            </div>
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/35">
              <QrCode className="h-3 w-3" /> QR del miembro
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="label">Link privado de su tarjeta</p>
              <div className="flex gap-2">
                <input readOnly value={cardUrl} className="input flex-1 font-mono text-xs" />
                <button
                  type="button"
                  onClick={copyCardUrl}
                  className="btn-secondary shrink-0 px-4 py-2"
                  aria-label="Copiar link"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-white/35">
                Es secreto: quien lo tenga ve su tarjeta. Envíaselo solo a la persona.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary px-4 py-2 text-sm"
                >
                  <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
                </a>
              )}

              <select
                value={member.status}
                disabled={busy}
                onChange={(e) => changeStatus(e.target.value as Member["status"])}
                aria-label="Estado de la membresía"
                className="input w-auto py-2 text-sm"
              >
                <option value="activa" className="bg-stride-card">
                  Activa
                </option>
                <option value="pausada" className="bg-stride-card">
                  Pausada
                </option>
                <option value="inactiva" className="bg-stride-card">
                  Inactiva
                </option>
              </select>

              <button
                type="button"
                onClick={rotateToken}
                disabled={busy}
                className="btn-secondary px-4 py-2 text-sm"
              >
                <RefreshCw className="h-4 w-4" /> Regenerar link
              </button>
            </div>

            {member.email && <p className="text-xs text-white/40">{member.email}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
