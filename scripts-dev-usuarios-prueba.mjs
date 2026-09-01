// Crea (idempotente) los usuarios de PRUEBA para testear la comunidad en localhost.
// Marcados "ZZ Prueba" — se eliminan con cleanup-test-users.mjs al terminar.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const env = Object.fromEntries(
  readFileSync("/Users/martin/Documents/Stride/web/.env.local", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);

const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function ensureAuthUser(email) {
  const { data: list } = await service.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
  if (existing) return existing.id;
  const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

// ── Miembro de prueba ──
const memberEmail = "prueba.comunidad@stridechile.cl";
const memberAuthId = await ensureAuthUser(memberEmail);
const { data: existingMember } = await service.from("members").select("id").eq("email", memberEmail).maybeSingle();
if (!existingMember) {
  const { error } = await service.from("members").insert({
    member_code: "STR-TEST",
    card_token: randomUUID(),
    full_name: "ZZ Prueba Comunidad (borrar)",
    email: memberEmail,
    status: "activa",
    valid_until: "2026-12-31",
    invitation_status: "enviada",
    notes: "USUARIO DE PRUEBA creado por Claude para testear la comunidad. Borrar.",
  });
  if (error) throw new Error(`insert member: ${error.message}`);
  console.log("miembro de prueba creado");
} else console.log("miembro de prueba ya existía");

// ── Staff de prueba (para las páginas de admin/comunidad) ──
const staffEmail = "prueba.staff+dev@stridechile.cl";
const staffAuthId = await ensureAuthUser(staffEmail);
const { data: existingStaff } = await service.from("team_members").select("id").eq("email", staffEmail).maybeSingle();
if (!existingStaff) {
  const { error } = await service.from("team_members").insert({
    auth_user_id: staffAuthId,
    full_name: "ZZ Prueba Staff (borrar)",
    email: staffEmail,
    role: "socio",
    status: "activo",
  });
  if (error) throw new Error(`insert staff: ${error.message}`);
  console.log("staff de prueba creado");
} else {
  await service.from("team_members").update({ auth_user_id: staffAuthId }).eq("email", staffEmail);
  console.log("staff de prueba ya existía");
}

console.log("OK", { memberAuthId, staffAuthId });
