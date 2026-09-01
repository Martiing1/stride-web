// Recordatorio del Encuentro Stride One vía Resend (dominio ya verificado).
// Uso desde web/:  node scripts-enviar-encuentro.mjs --dry | --send
import { readFileSync } from "node:fs";
import { Resend } from "resend";

for (const line of readFileSync(new URL(".env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const MODE = process.argv.includes("--send") ? "send" : "dry";
const FROM = "STRIDE <contacto@stridechile.cl>";
const SUBJECT = "Partimos a las 19:00 👟 Encuentro Stride One";
const MEET = "https://meet.google.com/xaa-dxkw-xfh";

const DESTINATARIOS = [
  "alagos.arq@gmail.com","ale.fuentesfigueroa@gmail.com","ana.saezchavez@gmail.com",
  "cabrerasanhuezad@gmail.com","cbovargas2003@gmail.com","celiaquevedo@gmail.com",
  "cmellaj87@gmail.com","cristobal.pastorini20@gmail.com","cristobal.tapia98@gmail.com",
  "danielagomezob@gmail.com","denisseelizet@gmail.com","elizabeth.toledo.baier@gmail.com",
  "elo.rar1607@gmail.com","erica77basto@gmail.com","esperanzaramosconcha@gmail.com",
  "igmues1@gmail.com","javimoralesag@gmail.com","juanjofloressv@gmail.com",
  "leticiaalvealulloa@gmail.com","matiasa057@gmail.com","mjconcha22@gmail.com",
  "natalialmr17@gmail.com","paula.cortes.ar@gmail.com","perlaaravena23@gmail.com",
  "tomasy652@gmail.com","v.andres.hr.89@gmail.com","vallejosbaezamariajose@gmail.com",
  "vicenteveraferrer@gmail.com","violeta.yasmin.oa@gmail.com","yessicaarrazola25@gmail.com",
];

// Morado STRIDE #7C3AED, igual que los otros correos de la plataforma.
const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <p>¡Hola! 👋</p>
  <p>Ya casi partimos con el <strong>Encuentro Stride One</strong> 🎉</p>
  <p>📅 Hoy lunes 31 de agosto<br>🕖 19:00 a 20:00 (hora Chile)</p>
  <p style="margin:28px 0">
    <a href="${MEET}" style="background:#7C3AED;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">💻 Entrar a la reunión</a>
  </p>
  <p>Vamos a mostrarte cómo funciona Stride One por dentro: el diagnóstico, tu plan según nivel, el foco del mes y el acompañamiento 🧭 Y sobre todo, a responder eso que te quedó dando vueltas — pregunta lo que quieras, para eso estamos 🙌</p>
  <p>Un par de cosas:<br>✅ Conéctate 5 minutitos antes así partimos a la hora<br>✅ Ven como estés: cámara prendida si te acomoda, y si no, también 😊</p>
  <p>¡Te esperamos! 🧡</p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0">
  <p style="font-size:13px;color:#888;margin:0">
    <strong>Equipo STRIDE</strong><br>
    <em>Deja de empezar de cero. Entrena con rumbo, sostén el hábito y avanza con tu gente</em> 🏃
  </p>
</div>`;

const text = `¡Hola! 👋

Ya casi partimos con el Encuentro Stride One 🎉
📅 Hoy lunes 31 de agosto
🕖 19:00 a 20:00 (hora Chile)
💻 Entra por acá: ${MEET}

Vamos a mostrarte cómo funciona Stride One por dentro: el diagnóstico, tu plan según nivel, el foco del mes y el acompañamiento 🧭 Y sobre todo, a responder eso que te quedó dando vueltas — pregunta lo que quieras, para eso estamos 🙌

Un par de cosas:
✅ Conéctate 5 minutitos antes así partimos a la hora
✅ Ven como estés: cámara prendida si te acomoda, y si no, también 😊

¡Te esperamos! 🧡

Equipo STRIDE
Deja de empezar de cero. Entrena con rumbo, sostén el hábito y avanza con tu gente 🏃`;

// Uno por persona: nadie ve la lista y entrega mejor que un CCO masivo.
const batch = DESTINATARIOS.map((to) => ({ from: FROM, to: [to], subject: SUBJECT, html, text }));

if (MODE === "dry") {
  console.log(`[DRY RUN] ${batch.length} correos listos, nada enviado.`);
  console.log(`From:   ${FROM}\nAsunto: ${SUBJECT}\nAPI key: ${process.env.RESEND_API_KEY ? "cargada ✅" : "FALTA ❌"}`);
  process.exit(0);
}

const { data, error } = await new Resend(process.env.RESEND_API_KEY).batch.send(batch);
if (error) { console.error("❌", error); process.exit(1); }
console.log(`✅ Enviados ${data?.data?.length ?? batch.length} correos.`);
