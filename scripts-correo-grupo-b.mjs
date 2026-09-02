// Correo post-Encuentro al Grupo B (no asistieron): PDF adjunto, sin precio, CTA a stridechile.cl y apertura del martes 8.
// Uso: node scripts-correo-grupo-b.mjs --dry | --send
import { readFileSync } from "node:fs";
import { Resend } from "resend";

const MODE = process.argv.includes("--send") ? "send" : "dry";
const env = {};
for (const line of readFileSync(new URL("./.env.local", import.meta.url), "utf8").split("\n")) {
  const t = line.trim();
  if (t && !t.startsWith("#") && t.includes("=")) {
    const i = t.indexOf("=");
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
  }
}
const pdf = readFileSync("/Users/martin/Downloads/Stride One.pdf").toString("base64");

const GRUPO_B = [
  { saludo: "Holaa Denisse! ¿Cómo estás?", email: "denisseelizet@gmail.com" },
  { saludo: "Hola Daniela!", email: "danielagomezob@gmail.com" },
  { saludo: "Erica, buenas!", email: "erica77basto@gmail.com" },
  { saludo: "Holaa Yessica! ¿Todo bien?", email: "yessicaarrazola25@gmail.com" },
  { saludo: "Aaron, hola!", email: "alagos.arq@gmail.com" },
  { saludo: "Hola Leticia! ¿Cómo va todo?", email: "leticiaalvealulloa@gmail.com" },
  { saludo: "Holaa Nati!", email: "natalialmr17@gmail.com" },
  { saludo: "Alejandra, buenas!", email: "ale.fuentesfigueroa@gmail.com" },
  { saludo: "Hola Eloísa! ¿Cómo estás?", email: "elo.rar1607@gmail.com" },
  { saludo: "Holaa María José!", email: "vallejosbaezamariajose@gmail.com" },
  { saludo: "Vicente, hola!", email: "vicenteveraferrer@gmail.com" },
  { saludo: "Hola Dani! ¿Cómo estás?", email: "cabrerasanhuezad@gmail.com" },
  { saludo: "Mathias, buenas!", email: "matiasa057@gmail.com" },
];

const html = (saludo) => `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;color:#333;line-height:1.65">
    <h2 style="color:#7C3AED;margin-bottom:4px">${saludo} 🖤</h2>
    <p>Ayer hicimos el <strong>Encuentro Stride One</strong> y te echamos de menos. Te lo decimos derecho: los correos con el link salieron con muy poca anticipación, así que si no alcanzaste a conectarte, la culpa fue nuestra.</p>
    <p>Lo primero: llegaste a Stride por los <strong>Social Runs</strong>, y eso no cambia — siguen siendo gratis y no necesitas ser miembro para ir. Cuando salga la próxima fecha te avisamos igual.</p>
    <p><strong>Stride One</strong> es el paso siguiente para quien quiere constancia de verdad: planes de 5K, 10K y 21K, comunidad privada, actividades del mes, club de lectura y convenios. Correr es la excusa; el fondo es el hábito y la gente.</p>
    <p>Te adjuntamos el <strong>PDF con la propuesta completa</strong>, y todo lo demás lo puedes ver en nuestra web:</p>
    <p style="margin:26px 0">
      <a href="https://stridechile.cl" style="background:#7C3AED;color:#fff;padding:13px 24px;border-radius:999px;text-decoration:none;font-weight:600">Conocer Stride One</a>
    </p>
    <p>Si te quedan dudas o quieres sumarte, responde este correo y lo vemos juntos 👊</p>
    <p style="margin-top:28px">Nos vemos corriendo,<br><strong>Martín & Juanjo · STRIDE</strong></p>
    <p style="font-size:12px;color:#999;margin-top:24px">Si prefieres que no te escribamos más, respóndenos y listo.</p>
  </div>`;

const resend = new Resend(env.RESEND_API_KEY);
for (const p of GRUPO_B) {
  if (MODE === "dry") { console.log("enviaría a:", p.email, "|", p.saludo); continue; }
  const { data, error } = await resend.emails.send({
    from: env.LEADS_NOTIFY_FROM ?? "STRIDE <hola@stridechile.cl>",
    to: [p.email],
    subject: "Stride One — la propuesta completa y tu cupo para el martes 8",
    html: html(p.saludo),
    attachments: [{ filename: "Stride One.pdf", content: pdf }],
  });
  console.log(error ? `ERROR ${p.email}: ${error.message}` : `enviado ✓ ${p.email} (${data.id})`);
  await new Promise((r) => setTimeout(r, 600)); // respeta rate limit de Resend
}
console.log("modo:", MODE, "| total:", GRUPO_B.length);
