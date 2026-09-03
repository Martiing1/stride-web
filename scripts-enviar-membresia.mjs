// Campaña: invitar a STRIDE ONE a quienes corrieron en un Social Run.
//
// Uso desde web/:
//   node scripts-enviar-membresia.mjs --preview        → solo a Martín
//   node scripts-enviar-membresia.mjs --dry            → lista, no envía
//   node scripts-enviar-membresia.mjs --send --limite 100 [--desde 2026-08-01]
//
// Escribe solo a leads con marketing_consent, nunca a socios, y de a tandas:
// el dominio es nuevo y mandar todo de una lo quema.
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const env = Object.fromEntries(
  readFileSync(new URL("./.env.local", import.meta.url), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const MODO = process.argv.includes("--send") ? "send" : process.argv.includes("--preview") ? "preview" : "dry";
const LIMITE = Number(arg("--limite", 100));
const DESDE = arg("--desde", null);
const FROM = "STRIDE <hola@stridechile.cl>";
const ASUNTO = "Lo que viene después del Social Run";
const PREVIEW_TO = "martin.munoz.padilla1@gmail.com";

const firmaBaja = (email) =>
  createHmac("sha256", env.SUPABASE_SERVICE_ROLE_KEY).update(`baja:${email.toLowerCase()}`).digest("hex").slice(0, 16);

function html(nombre, email) {
  const baja = `https://stridechile.cl/baja?e=${encodeURIComponent(email)}&s=${firmaBaja(email)}`;
  return `
  <div style="background:#f2f3f8;padding:32px 16px;font-family:-apple-system,'Segoe UI',system-ui,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(20,22,36,.08)">
        <tr><td align="center" style="background:#0e1017;padding:30px 24px 26px">
          <img src="https://stridechile.cl/stride_logo_clean.png" width="132" alt="STRIDE" style="display:block;max-width:132px;height:auto">
        </td></tr>
        <tr><td style="height:5px;background:#6366f1;background:linear-gradient(90deg,#00E5FF,#6366F1,#FF00FF);font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:36px 36px 8px">
          <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#171a24">Hola ${nombre} 🖤</h1>
          <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#3d4254">
            Corriste con nosotros en un Social Run hace poco, así que te escribimos a ti primero.
          </p>
          <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#3d4254">
            Los Social Runs siguen siendo gratis y no cambian. Pero muchos nos dijeron lo mismo después de
            correr: <em>“me encantó, pero entre domingo y domingo se me desarma”</em>. Para eso armamos
            <strong>STRIDE ONE</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:6px 36px 0">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6366f1">Qué es</p>
          <p style="margin:0 0 9px;font-size:15px;line-height:1.6;color:#3d4254">🏃&nbsp;&nbsp;Un <strong>plan mensual según tu nivel</strong> (5K, 10K o 21K), pensado para semanas reales, no perfectas</p>
          <p style="margin:0 0 9px;font-size:15px;line-height:1.6;color:#3d4254">🎯&nbsp;&nbsp;<strong>Retos del mes</strong> y hábitos que marcas a diario, para no depender de la motivación</p>
          <p style="margin:0 0 9px;font-size:15px;line-height:1.6;color:#3d4254">🖤&nbsp;&nbsp;Una <strong>comunidad privada</strong> con sesiones en vivo, donde se premia la constancia y nunca la velocidad</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#3d4254">💳&nbsp;&nbsp;Tu <strong>carnet con beneficios</strong> en cafeterías y tiendas aliadas</p>
        </td></tr>
        <tr><td style="padding:24px 36px 4px">
          <p style="margin:0;font-size:16px;line-height:1.6;color:#171a24"><strong>$31.990 al mes, sin permanencia.</strong> Puedes probar un mes y decidir.</p>
        </td></tr>
        <tr><td align="center" style="padding:18px 36px 10px">
          <a href="https://stridechile.cl/one" style="display:inline-block;background:#7C3AED;color:#ffffff;padding:15px 34px;border-radius:999px;text-decoration:none;font-weight:700;font-size:16px">Ver de qué se trata</a>
        </td></tr>
        <tr><td style="padding:22px 36px 32px">
          <p style="margin:0;padding-top:18px;border-top:1px solid #e8eaf2;font-size:12.5px;line-height:1.6;color:#9aa1b5">
            Te escribimos porque te inscribiste en un Social Run de STRIDE. Si prefieres no recibir estos correos,
            <a href="${baja}" style="color:#6a7186;text-decoration:underline">te sacamos de la lista en un click</a>
            y no te molestamos más. Nos vemos igual el próximo domingo 🙌
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

if (MODO === "preview") {
  const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
    from: FROM, to: [PREVIEW_TO], subject: ASUNTO,
    html: html("Martín", PREVIEW_TO),
    headers: { "List-Unsubscribe": `<https://stridechile.cl/baja?e=${encodeURIComponent(PREVIEW_TO)}&s=${firmaBaja(PREVIEW_TO)}>` },
  });
  console.log(error ? `✗ ${error.message}` : `✓ Vista previa enviada a ${PREVIEW_TO}`);
  process.exit(0);
}

let q = supa.from("leads").select("full_name, email, consented_at, temperature")
  .eq("marketing_consent", true).eq("source", "evently").eq("status", "nuevo")
  .order("consented_at", { ascending: false });
if (DESDE) q = q.gte("consented_at", DESDE);
const { data: leads } = await q;

const { data: miembros } = await supa.from("members").select("email");
const socios = new Set((miembros ?? []).map((m) => (m.email || "").toLowerCase()));
const destino = (leads ?? []).filter((l) => l.email && !socios.has(l.email.toLowerCase())).slice(0, LIMITE);

if (MODO === "dry") {
  console.log(`[DRY] ${destino.length} destinatarios (tope ${LIMITE}${DESDE ? `, desde ${DESDE}` : ""}), nada enviado.`);
  for (const d of destino.slice(0, 5)) console.log(`   ${(d.full_name||"").slice(0,24).padEnd(24)} ${d.email}  ${(d.consented_at||"").slice(0,10)}`);
  if (destino.length > 5) console.log(`   … y ${destino.length - 5} más`);
} else {
  const resend = new Resend(env.RESEND_API_KEY);
  const lote = destino.map((d) => ({
    from: FROM, to: [d.email], subject: ASUNTO,
    html: html((d.full_name || "").trim().split(" ")[0] || "corredor", d.email),
    headers: { "List-Unsubscribe": `<https://stridechile.cl/baja?e=${encodeURIComponent(d.email)}&s=${firmaBaja(d.email)}>` },
  }));
  const { data, error } = await resend.batch.send(lote);
  if (error) { console.error("✗", error.message); process.exit(1); }
  await supa.from("leads").update({ status: "contactado" }).in("email", destino.map((d) => d.email));
  console.log(`✅ enviados ${data?.data?.length ?? lote.length} correos y marcados como contactados.`);
}
