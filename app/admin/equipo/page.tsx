import { requireTeamMember } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TeamManager } from "@/components/admin/TeamManager";
import type { TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const me = await requireTeamMember(["socio"]);
  const supabase = await createClient();

  const { data } = await supabase.from("team_members").select("*").order("role").order("full_name");
  const team = (data ?? []) as TeamMember[];

  // Fotos: URLs firmadas de corta vida desde el bucket privado.
  const service = createServiceClient();
  const photoUrls: Record<string, string> = {};
  await Promise.all(
    team
      .filter((p) => p.photo_path)
      .map(async (p) => {
        const { data: signed } = await service.storage
          .from("team-photos")
          .createSignedUrl(p.photo_path!, 600);
        if (signed?.signedUrl) photoUrls[p.id] = signed.signedUrl;
      })
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Equipo</h1>
        <p className="mt-1 max-w-2xl text-white/50">
          {team.length} personas. Pincha la foto para cambiarla. Quien no tenga cuenta enlazada
          aún no puede entrar al sistema.
        </p>
      </header>

      <TeamManager team={team} photoUrls={photoUrls} currentMemberId={me.id} />

      <p className="card text-sm leading-relaxed text-white/50">
        Para darle acceso a alguien: crea su usuario en Supabase Auth con su email, y pega el ID de
        ese usuario en la columna <code className="text-stride-accent">auth_user_id</code> de su
        fila. Luego esa persona inscribe su app autenticadora en su primer ingreso.
      </p>
    </div>
  );
}
