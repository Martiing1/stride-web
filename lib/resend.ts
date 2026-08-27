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
