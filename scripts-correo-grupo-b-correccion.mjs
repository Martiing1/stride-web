// Corrección al Grupo B: la reunión de apertura del martes 8 NO se realizará.
// Uso: node scripts-correo-grupo-b-correccion.mjs --dry | --send
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

const GRUPO_B = [
  { nombre: "Denisse", email: "denisseelizet@gmail.com" },
  { nombre: "Daniela", email: "danielagomezob@gmail.com" },
  { nombre: "Erica", email: "erica77basto@gmail.com" },
  { nombre: "Yessica", email: "yessicaarrazola25@gmail.com" },
  { nombre: "Aaron", email: "alagos.arq@gmail.com" },
  { nombre: "Leticia", email: "leticiaalvealulloa@gmail.com" },
  { nombre: "Nati", email: "natalialmr17@gmail.com" },
  { nombre: "Alejandra", email: "ale.fuentesfigueroa@gmail.com" },
  { nombre: "Eloísa", email: "elo.rar1607@gmail.com" },
  { nombre: "María José", email: "vallejosbaezamariajose@gmail.com" },
  { nombre: "Vicente", email: "vicenteveraferrer@gmail.com" },
  { nombre: "Dani", email: "cabrerasanhuezad@gmail.com" },
  { nombre: "Mathias", email: "matiasa057@gmail.com" },
];

const html = (nombre) => `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;color:#333;line-height:1.65">
    <h2 style="color:#7C3AED;margin-bottom:4px">Hola ${nombre} 🖤</h2>
    <p>Te escribimos de nuevo por una corrección al correo que te mandamos hoy: <strong>la reunión de apertura del martes 8 no se va a realizar</strong> — fue un error nuestro incluirla. Perdón por la confusión 🙏</p>
    <p>Todo lo demás sigue igual: el PDF con la propuesta que te adjuntamos, la web <a href="https://stridechile.cl" style="color:#7C3AED;font-weight:600">stridechile.cl</a>, y si quieres sumarte o te queda cualquier duda, respondes este correo y lo vemos directamente contigo.</p>
    <p style="margin-top:28px">Nos vemos corriendo,<br><strong>Martín & Juanjo · STRIDE</strong></p>
  </div>`;

const resend = new Resend(env.RESEND_API_KEY);
for (const p of GRUPO_B) {
  if (MODE === "dry") { console.log("enviaría a:", p.email, "|", p.nombre); continue; }
  const { data, error } = await resend.emails.send({
    from: env.LEADS_NOTIFY_FROM ?? "STRIDE <hola@stridechile.cl>",
    to: [p.email],
    subject: "Corrección: la reunión del martes 8 no se realizará",
    html: html(p.nombre),
  });
  console.log(error ? `ERROR ${p.email}: ${error.message}` : `enviado ✓ ${p.email} (${data.id})`);
  await new Promise((r) => setTimeout(r, 600));
}
console.log("modo:", MODE, "| total:", GRUPO_B.length);
