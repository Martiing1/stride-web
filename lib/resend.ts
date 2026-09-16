import { Resend } from "resend";
import { SITE } from "./site";
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
 * Correo de bienvenida y acceso a la plataforma de miembros, enviado por nosotros.
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
    subject: "Bienvenida a STRIDE ONE — tu acceso a la plataforma",
    html: memberAccessEmailHtml(firstName, link, code),
  });
}

/** HTML del correo de bienvenida. Tablas + estilos inline por compatibilidad de clientes. */
export function memberAccessEmailHtml(firstName: string, link: string, code: string | null): string {
  return `
  <div style="background:#f2f3f8;padding:32px 16px;font-family:-apple-system,'Segoe UI',system-ui,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(20,22,36,.08)">
        <tr><td align="center" style="background:#0e1017;padding:30px 24px 26px">
          <img src="https://stridechile.cl/stride_logo_clean.png" width="132" alt="STRIDE" style="display:block;max-width:132px;height:auto">
        </td></tr>
        <tr><td style="height:5px;background:#6366f1;background:linear-gradient(90deg,#00E5FF,#6366F1,#FF00FF);font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:36px 36px 8px">
          <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#171a24">Hola ${firstName} 🖤</h1>
          <p style="margin:0 0 8px;font-size:16px;line-height:1.65;color:#3d4254">¡Ya eres parte de <strong>STRIDE ONE</strong>! Tu acceso a la plataforma de miembros está listo:</p>
        </td></tr>
        <tr><td align="center" style="padding:18px 36px 10px">
          <a href="${link}" style="display:inline-block;background:#7C3AED;color:#ffffff;padding:15px 34px;border-radius:999px;text-decoration:none;font-weight:700;font-size:16px">Entrar a la plataforma</a>
        </td></tr>
        ${code ? `
        <tr><td style="padding:16px 36px 0">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#6a7186">Si el botón no funciona, entra a <a href="https://stridechile.cl/miembros/ingresar" style="color:#7C3AED;font-weight:600;text-decoration:none">stridechile.cl/miembros/ingresar</a> y escribe este código:</p>
        </td></tr>
        <tr><td align="center" style="padding:12px 36px 6px">
          <div style="background:#f1f3fa;border-radius:12px;padding:14px 20px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:28px;letter-spacing:8px;color:#171a24;font-weight:600">${code}</div>
        </td></tr>` : ""}
        <tr><td style="padding:26px 36px 6px">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6366f1">Lo que te espera adentro</p>
          <p style="margin:0 0 9px;font-size:15px;line-height:1.6;color:#3d4254">🎥&nbsp;&nbsp;El curso de <strong>Onboarding</strong> — parte por ahí: qué incluye tu membresía y cómo se usa todo</p>
          <p style="margin:0 0 9px;font-size:15px;line-height:1.6;color:#3d4254">🏃&nbsp;&nbsp;Tu <strong>plan de entrenamiento</strong> según nivel (5K, 10K o 21K)</p>
          <p style="margin:0 0 9px;font-size:15px;line-height:1.6;color:#3d4254">🎯&nbsp;&nbsp;Los <strong>retos del mes</strong> y micro-retos semanales</p>
          <p style="margin:0 0 9px;font-size:15px;line-height:1.6;color:#3d4254">🖤&nbsp;&nbsp;La <strong>comunidad</strong>: el blog, el calendario y la gente</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#3d4254">💳&nbsp;&nbsp;Tu <strong>carnet</strong> con los beneficios en comercios aliados</p>
        </td></tr>
        <tr><td style="padding:24px 36px 32px">
          <p style="margin:0;padding-top:18px;border-top:1px solid #e8eaf2;font-size:12.5px;line-height:1.6;color:#9aa1b5">
            El enlace sirve una sola vez y vence en una hora — si se te pasa, pide un código nuevo en stridechile.cl/miembros/ingresar con este mismo correo. Guarda tu carnet en la pantalla de inicio de tu teléfono para tenerlo a mano.
          </p>
        </td></tr>
      </table>
      <p style="margin:22px 0 0;font-size:12.5px;color:#9aa1b5;line-height:1.6">
        <em>Correr es la excusa para socializar.</em><br>
        STRIDE · Concepción · <a href="https://stridechile.cl" style="color:#9aa1b5">stridechile.cl</a>
      </p>
    </td></tr></table>
  </div>`;
}

// ─── Cola de verificación ────────────────────────────────────────────────────

interface ReviewAlert {
  kind: "reto" | "medalla" | "pausa";
  memberName: string;
  title: string;
}

/**
 * Avisa al staff (mismos destinatarios que los leads) que entró algo a la
 * cola de verificación. Sin aviso, una evidencia podía esperar días sin que
 * nadie abriera el ERP. Nunca bota la acción del miembro: traga sus errores.
 */
export async function notifyStaffReview(item: ReviewAlert): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.LEADS_NOTIFY_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!apiKey || to.length === 0) return;

  const label = item.kind === "reto" ? "Evidencia de reto" : item.kind === "medalla" ? "Medalla física" : "Solicitud de pausa";
  // admin.stridechile.cl sirve /admin/* sin el prefijo (middleware).
  const queueUrl = `${SITE.adminUrl}/miembros`;
  try {
    await new Resend(apiKey).emails.send({
      from: process.env.LEADS_NOTIFY_FROM ?? "STRIDE <hola@stridechile.cl>",
      to,
      subject: `${label} por verificar: ${item.memberName}`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px">
          <h2 style="color:#7C3AED;margin-bottom:4px">${label} esperando tu visto bueno</h2>
          <p style="margin:12px 0"><strong>${escapeHtml(item.memberName)}</strong> · ${escapeHtml(item.title)}</p>
          <p><a href="${queueUrl}" style="display:inline-block;background:#7C3AED;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Abrir la cola de verificación</a></p>
          <p style="margin-top:24px;font-size:13px;color:#888">Aprobar paga los puntos al tiro y le avisa por la campana.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("[resend] notifyStaffReview", error);
  }
}

function escapeHtml(value: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (c) => map[c] ?? c);
}
