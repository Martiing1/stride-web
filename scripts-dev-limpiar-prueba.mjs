// Elimina los usuarios de PRUEBA creados por scripts-dev-usuarios-prueba.mjs
// (miembro "ZZ Prueba Comunidad" y staff "ZZ Prueba Staff"), incluidas sus
// cuentas de Auth. Ejecutar cuando termines de probar: node scripts-dev-limpiar-prueba.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("./.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);

const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAILS = ["prueba.comunidad@stridechile.cl", "prueba.staff+dev@stridechile.cl"];

// Eventos DEMO del calendario (seed de scripts-dev-seed-demo.mjs)
const { error: demoError } = await service.from("events").delete().like("code", "EVT-DEMO-%");
console.log(demoError ? `eventos demo: ${demoError.message}` : "eventos demo eliminados");

// Publicaciones hechas por el staff de prueba (antes de borrar su fila)
const { data: testStaff } = await service.from("team_members").select("id").eq("email", EMAILS[1]).maybeSingle();
if (testStaff) {
  const { error } = await service.from("community_posts").delete().eq("author_team_member_id", testStaff.id);
  console.log(error ? `posts staff prueba: ${error.message}` : "posts del staff de prueba eliminados");
}

// Posts del miembro de prueba primero (el CHECK de community_posts impide dejarlos huérfanos)
const { data: testMember } = await service.from("members").select("id").eq("email", EMAILS[0]).maybeSingle();
if (testMember) await service.from("community_posts").delete().eq("author_member_id", testMember.id);

const { error: memberError } = await service.from("members").delete().eq("email", EMAILS[0]);
if (memberError) console.error("members:", memberError.message);
else console.log("miembro de prueba eliminado");

const { error: staffError } = await service.from("team_members").delete().eq("email", EMAILS[1]);
if (staffError) console.error("team_members:", staffError.message);
else console.log("staff de prueba eliminado");

const { data: list } = await service.auth.admin.listUsers({ perPage: 200 });
for (const email of EMAILS) {
  const user = list?.users?.find((u) => u.email?.toLowerCase() === email);
  if (user) {
    const { error } = await service.auth.admin.deleteUser(user.id);
    console.log(error ? `auth ${email}: ${error.message}` : `auth ${email} eliminado`);
  }
}
console.log("Limpieza lista.");
