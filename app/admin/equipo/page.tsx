import { requireTeamMember, ROLE_LABELS } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROLE_STYLES: Record<string, string> = {
  socio: "bg-stride-accent/15 text-stride-accent",
  lider_comunidad: "bg-amber-500/15 text-amber-400",
  monitor: "bg-white/10 text-white/60",
};

export default async function EquipoPage() {
  await requireTeamMember(["socio"]);
  const supabase = await createClient();

  const { data } = await supabase.from("team_members").select("*").order("role").order("full_name");
  const team = (data ?? []) as TeamMember[];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Equipo</h1>
        <p className="mt-1 max-w-2xl text-white/50">
          {team.length} personas. Quien no tenga cuenta enlazada aún no puede entrar al sistema.
        </p>
      </header>

      <section className="space-y-2">
        {team.map((person) => (
          <div key={person.id} className="card flex flex-wrap items-center gap-4 py-4">
            <div className="min-w-[180px] flex-1">
              <p className="font-medium text-white">
                {person.full_name}
                {person.nickname && person.nickname !== person.full_name && (
                  <span className="ml-1.5 text-sm text-white/40">({person.nickname})</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-white/40">
                {person.email.startsWith("PENDIENTE") ? (
                  <span className="text-amber-400/70">Falta su correo real</span>
                ) : (
                  person.email
                )}
                {person.area && ` · ${person.area}`}
              </p>
            </div>

            {!person.auth_user_id && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-400">
                Sin acceso
              </span>
            )}

            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                ROLE_STYLES[person.role]
              }`}
            >
              {ROLE_LABELS[person.role]}
            </span>

            {person.status === "inactivo" && (
              <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/40">
                Inactivo
              </span>
            )}
          </div>
        ))}
      </section>

      <p className="card text-sm leading-relaxed text-white/50">
        Para darle acceso a alguien: crea su usuario en Supabase Auth con su email, y pega el ID de
        ese usuario en la columna <code className="text-stride-accent">auth_user_id</code> de su
        fila. Luego esa persona inscribe su app autenticadora en su primer ingreso.
      </p>
    </div>
  );
}
