import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Role, TeamMember } from "./types";

/**
 * Devuelve la persona del equipo asociada a la sesión actual, o null.
 * Una cuenta de Supabase Auth que no esté en team_members (o esté inactiva)
 * cuenta como sin acceso, aunque el login haya sido correcto.
 */
export async function getCurrentTeamMember(): Promise<TeamMember | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("team_members")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("status", "activo")
    .maybeSingle();

  return (data as TeamMember) ?? null;
}

/**
 * Exige sesión + pertenencia al equipo. Si además se pasan roles, exige uno
 * de ellos. Se usa al inicio de cada página del ERP.
 */
export async function requireTeamMember(allowedRoles?: Role[]): Promise<TeamMember> {
  const member = await getCurrentTeamMember();

  if (!member) redirect("/admin/login");

  if (allowedRoles && !allowedRoles.includes(member.role)) {
    redirect("/admin?error=sin-permiso");
  }

  return member;
}

// Se reexportan para que el código de servidor siga importándolas desde acá.
export { ROLE_LABELS, isStaff } from "./roles";
