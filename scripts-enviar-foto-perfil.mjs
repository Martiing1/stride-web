// Pide a los miembros de STRIDE ONE que suban su foto de perfil.
//
// Uso desde web/:
//   node scripts-enviar-foto-perfil.mjs --preview   → solo a Martín, para revisar
//   node scripts-enviar-foto-perfil.mjs --dry       → lista destinatarios, no envía
//   node scripts-enviar-foto-perfil.mjs --send      → envía a los miembros sin foto
//
// Solo se escribe a miembros con membresía activa que todavía no tienen foto.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const env = Object.fromEntries(
  readFileSync(new URL("./.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const MODE = process.argv.includes("--send") ? "send" : process.argv.includes("--preview") ? "preview" : "dry";
const FROM = "STRIDE <miembros@stridechile.cl>";
const SUBJECT = "Ponle tu cara a la comunidad 📸";
const PREVIEW_TO = "martin.munoz.padilla1@gmail.com";

export function fotoPerfilEmailHtml(firstName) {
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
          <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#3d4254">
            Una cosita chica que hace la diferencia: <strong>sube tu foto de perfil</strong> en la plataforma.
          </p>
          <p style="margin:0;font-size:16px;line-height:1.65;color:#3d4254">
            Cuando publicas en el blog, comentas o apareces en el ranking del mes, tu foto es lo que hace que
            el resto te reconozca. Y en los Social Runs ayuda un montón a que lleguemos sabiendo quién es quién.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:22px 36px 10px">
          <a href="https://stridechile.cl/miembros/perfil" style="display:inline-block;background:#7C3AED;color:#ffffff;padding:15px 34px;border-radius:999px;text-decoration:none;font-weight:700;font-size:16px">Subir mi foto</a>
        </td></tr>
        <tr><td style="padding:18px 36px 0">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6366f1">Cómo se hace</p>
          <p style="margin:0 0 9px;font-size:15px;line-height:1.6;color:#3d4254">1&nbsp;&nbsp;Entra a <strong>Perfil</strong> en la plataforma</p>
          <p style="margin:0 0 9px;font-size:15px;line-height:1.6;color:#3d4254">2&nbsp;&nbsp;Toca <strong>Cambiar foto</strong> y elige una del teléfono</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#3d4254">3&nbsp;&nbsp;Listo, queda al tiro en tu carnet y en la comunidad</p>
        </td></tr>
        <tr><td style="padding:26px 36px 32px">
          <p style="margin:0;padding-top:18px;border-top:1px solid #e8eaf2;font-size:12.5px;line-height:1.6;color:#9aa1b5">
            Tu foto la ven solo los miembros de STRIDE ONE, nunca es pública. Si prefieres no poner una, no pasa
            nada: es opcional.
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

const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: miembros } = await supa
  .from("members")
  .select("full_name, email, photo_path, status")
  .eq("status", "activa")
  .order("full_name");

const destinatarios = (miembros ?? [])
  .filter((m) => m.email && !m.photo_path && !/prueba/i.test(m.full_name ?? ""))
  .map((m) => ({ to: m.email, nombre: (m.full_name ?? "").trim().split(" ")[0] || "corredor" }));

if (MODE === "preview") {
  const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
    from: FROM, to: [PREVIEW_TO], subject: SUBJECT, html: fotoPerfilEmailHtml("Martín"),
  });
  console.log(error ? `✗ ${error.message}` : `✓ Vista previa enviada a ${PREVIEW_TO}`);
  console.log(`   Al aprobar, saldría a ${destinatarios.length}: ${destinatarios.map((d) => d.nombre).join(", ")}`);
} else if (MODE === "dry") {
  console.log(`[DRY] ${destinatarios.length} destinatarios, nada enviado:`);
  for (const d of destinatarios) console.log(`   ${d.nombre.padEnd(12)} ${d.to}`);
} else {
  const resend = new Resend(env.RESEND_API_KEY);
  const batch = destinatarios.map((d) => ({ from: FROM, to: [d.to], subject: SUBJECT, html: fotoPerfilEmailHtml(d.nombre) }));
  const { data, error } = await resend.batch.send(batch);
  if (error) { console.error("✗", error.message); process.exit(1); }
  console.log(`✅ Enviados ${data?.data?.length ?? batch.length} correos.`);
}
