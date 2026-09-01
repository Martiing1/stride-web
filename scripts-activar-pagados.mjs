// Activa miembros que ya pagaron: crea ficha, auth user, magiclink y correo de acceso.
// Uso:  node scripts-activar-pagados.mjs --dry   |   node scripts-activar-pagados.mjs --send
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
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
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
const supa = createClient(URL_, KEY, { auth: { persistSession: false } });
const SITE = "https://stridechile.cl";

const READABLE = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const code = () => "STR-" + Array.from(randomBytes(6)).map((b) => READABLE[b % READABLE.length]).join("");

const PAGADOS = [
  { full_name: "Violeta Ortega", email: "violeta.yasmin.oa@gmail.com", whatsapp: "+56978986838" },
  { full_name: "Paula Cortés", email: "paula.cortes.ar@gmail.com", whatsapp: null },
];

const finDeMes = "2026-09-30";

for (const p of PAGADOS) {
  console.log(`\n=== ${p.full_name} <${p.email}> ===`);

  // 1. ficha de miembro
  let { data: member } = await supa.from("members").select("*").ilike("email", p.email).maybeSingle();
  if (member) {
    console.log("ficha existente:", member.member_code, member.status);
    if (MODE === "send" && member.status !== "activa") {
      await supa.from("members").update({ status: "activa", valid_until: finDeMes }).eq("id", member.id);
      console.log("→ activada hasta", finDeMes);
    }
  } else if (MODE === "dry") {
    console.log("crearía ficha: activa hasta", finDeMes);
  } else {
    const { data, error } = await supa
      .from("members")
      .insert({
        member_code: code(),
        card_token: randomBytes(16).toString("hex"),
        full_name: p.full_name,
        email: p.email.toLowerCase(),
        whatsapp: p.whatsapp,
        status: "activa",
        valid_until: finDeMes,
        invitation_status: "pendiente",
        notes: "Pago verificado 01-09 (lanzamiento). Alta por Claude a pedido de Martín.",
      })
      .select("*")
      .single();
    if (error) { console.error("ERROR ficha:", error.message); continue; }
    member = data;
    console.log("ficha creada:", member.member_code, "activa hasta", finDeMes);
  }
  if (MODE === "dry") { console.log("crearía auth user + magiclink + correo"); continue; }

  // 2. auth user
  let authUserId = null;
  const { data: created, error: cErr } = await supa.auth.admin.createUser({
    email: p.email.toLowerCase(),
    email_confirm: true,
  });
  if (created?.user) authUserId = created.user.id;
  else if (cErr && /already/i.test(cErr.message)) {
    const { data: list } = await supa.auth.admin.listUsers({ perPage: 200 });
    authUserId = list?.users?.find((u) => u.email?.toLowerCase() === p.email.toLowerCase())?.id ?? null;
    console.log("auth user existente");
  } else if (cErr) { console.error("ERROR auth:", cErr.message); continue; }
  if (!authUserId) { console.error("sin auth user"); continue; }

  // 3. magiclink
  const { data: link, error: lErr } = await supa.auth.admin.generateLink({
    type: "magiclink",
    email: p.email.toLowerCase(),
    options: { redirectTo: `${SITE}/auth/callback?next=/miembros` },
  });
  if (lErr || !link?.properties) { console.error("ERROR link:", lErr?.message); continue; }
  const u = new URL(`${SITE}/auth/callback`);
  u.searchParams.set("token_hash", link.properties.hashed_token);
  u.searchParams.set("type", "magiclink");
  u.searchParams.set("next", "/miembros");
  const otp = link.properties.email_otp ?? null;

  // 4. correo (misma plantilla oficial de lib/resend.ts)
  const resend = new Resend(env.RESEND_API_KEY);
  const firstName = p.full_name.trim().split(" ")[0];
  const { error: mErr } = await resend.emails.send({
    from: env.LEADS_NOTIFY_FROM ?? "STRIDE <hola@stridechile.cl>",
    to: [p.email.toLowerCase()],
    subject: "Bienvenida a STRIDE ONE — tu acceso a la plataforma",
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px">
        <h2 style="color:#7C3AED;margin-bottom:4px">Hola ${firstName} 🖤</h2>
        <p style="color:#444;line-height:1.6">¡Tu pago está confirmado y ya eres parte de <strong>STRIDE ONE</strong>! Tu acceso a la plataforma de miembros está listo:</p>
        <p style="margin:28px 0">
          <a href="${u.toString()}" style="background:#7C3AED;color:#fff;padding:14px 24px;border-radius:999px;text-decoration:none;font-weight:600">Entrar a la plataforma</a>
        </p>
        ${otp ? `<p style="color:#444;line-height:1.6">Si el botón no funciona, entra a <a href="https://stridechile.cl/miembros/ingresar">stridechile.cl/miembros/ingresar</a> y escribe este código:</p>
        <p style="font-family:monospace;font-size:28px;letter-spacing:6px;color:#111;margin:8px 0 24px">${otp}</p>` : ""}
        <p style="color:#444;line-height:1.6">Adentro encontrarás el curso de <strong>Onboarding</strong> (empieza por ahí: explica qué incluye tu membresía y cómo usar cada sección), tu plan de entrenamiento, los retos del mes y tu carnet con los beneficios en comercios aliados.</p>
        <p style="font-size:13px;color:#888;line-height:1.6">
          El enlace sirve una sola vez y vence en una hora — si se te pasa, pide un código nuevo en stridechile.cl/miembros/ingresar con este mismo correo. Guarda tu carnet en la pantalla de inicio del teléfono para tenerlo a mano.
        </p>
      </div>
    `,
  });
  if (mErr) { console.error("ERROR correo:", mErr.message); continue; }
  console.log("correo enviado ✓");

  // 5. marcar invitación
  await supa.from("members").update({
    auth_user_id: authUserId,
    invitation_status: "enviada",
    invited_at: new Date().toISOString(),
  }).eq("id", member.id);

  // 6. lead → convertido
  const { data: lead } = await supa.from("leads").select("id,notes").ilike("email", p.email).maybeSingle();
  if (lead) {
    await supa.from("leads").update({
      status: "convertido",
      notes: (lead.notes ?? "") + " · Pagó y activada como miembro el 01-09.",
    }).eq("id", lead.id);
    console.log("lead → convertido ✓");
  }
}
console.log(`\nmodo: ${MODE}`);
