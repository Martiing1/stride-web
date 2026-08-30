import { Resend } from "resend";
import { MOTIVATION_LABELS } from "./lead-options";
import type { Motivation } from "./types";

interface LeadNotification {
  full_name: string;
  email: string;
  whatsapp: string;
  motivation: Motivation;
}

/** Avisa a Martín y Juanjo apenas entra un lead por la landing. */
export async function notifyNewLead(lead: LeadNotification) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.LEADS_NOTIFY_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!apiKey || to.length === 0) return;

  const resend = new Resend(apiKey);
  const motivation = MOTIVATION_LABELS[lead.motivation] ?? lead.motivation;
  const waNumber = lead.whatsapp.replace(/[^0-9]/g, "");
  // Un lead que pidió la membresía derecho merece respuesta distinta.
  const isHot = lead.motivation === "membresia";

  await resend.emails.send({
    from: process.env.LEADS_NOTIFY_FROM ?? "STRIDE <hola@stridechile.cl>",
    to,
    replyTo: lead.email,
    subject: isHot
      ? `🔥 Quiere STRIDE ONE: ${lead.full_name}`
      : `Nuevo lead: ${lead.full_name}`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px">
        <h2 style="color:#7C3AED;margin-bottom:4px">Nuevo lead desde stridechile.cl</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <tr><td style="padding:8px 0;color:#666">Nombre</td><td style="padding:8px 0"><strong>${lead.full_name}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#666">Email</td><td style="padding:8px 0"><a href="mailto:${lead.email}">${lead.email}</a></td></tr>
          <tr><td style="padding:8px 0;color:#666">WhatsApp</td><td style="padding:8px 0"><a href="https://wa.me/${waNumber}">${lead.whatsapp}</a></td></tr>
          <tr><td style="padding:8px 0;color:#666">Qué busca</td><td style="padding:8px 0"><strong>${motivation}</strong></td></tr>
        </table>
        <p style="margin-top:24px;font-size:13px;color:#888">
          Queda registrado en el ERP en admin.stridechile.cl/leads
        </p>
      </div>
    `,
  });
}

interface MemberAccessEmail {
  to: string;
  fullName: string;
  link: string;
  code: string | null;
}

/** ¿Hay un remitente propio configurado? Si no, el correo lo manda Supabase. */
export function canSendOwnEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Correo de acceso al carnet, enviado por nosotros.
 *
 * Vale la pena no depender del correo de Supabase por dos razones: su SMTP de
 * cortesía entrega pocos mensajes por hora, y su enlace por defecto arrastra el
 * flujo con el que se pidió. El enlace de acá va con `token_hash`, que se puede
 * abrir en cualquier dispositivo.
 */
export async function sendMemberAccessEmail({ to, fullName, link, code }: MemberAccessEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY no configurada");

  const resend = new Resend(apiKey);
  const firstName = fullName.trim().split(" ")[0];

  await resend.emails.send({
    from: process.env.LEADS_NOTIFY_FROM ?? "STRIDE <hola@stridechile.cl>",
    to: [to],
    subject: "Tu carnet STRIDE ONE",
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px">
        <h2 style="color:#7C3AED;margin-bottom:4px">Hola ${firstName}</h2>
        <p style="color:#444;line-height:1.6">Tu carnet digital STRIDE ONE está listo. Ábrelo con este botón:</p>
        <p style="margin:28px 0">
          <a href="${link}" style="background:#7C3AED;color:#fff;padding:14px 24px;border-radius:999px;text-decoration:none;font-weight:600">Abrir mi carnet</a>
        </p>
        ${code ? `<p style="color:#444;line-height:1.6">Si el botón no funciona, entra a <a href="https://stridechile.cl/miembros/ingresar">stridechile.cl/miembros/ingresar</a> y escribe este código:</p>
        <p style="font-family:monospace;font-size:28px;letter-spacing:6px;color:#111;margin:8px 0 24px">${code}</p>` : ""}
        <p style="font-size:13px;color:#888;line-height:1.6">
          El enlace sirve una sola vez y vence en una hora. Guarda el carnet en la pantalla de inicio de tu teléfono para tenerlo a mano.
        </p>
      </div>
    `,
  });
}
