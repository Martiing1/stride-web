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
          {team.length} personas. Pincha la foto para cambiarla. Usa &ldquo;Dar acceso&rdquo; para enviar
          la invitación al correo de cada persona; no necesitas copiar IDs desde Supabase.
        </p>
      </header>

      <TeamManager team={team} photoUrls={photoUrls} currentMemberId={me.id} />

      <p className="card text-sm leading-relaxed text-white/50">
        El acceso al ERP lo define una fila activa en <code className="text-stride-accent">team_members</code>,
        no el hecho de tener cuenta en Supabase Auth ni de ser miembro. Una misma cuenta puede ser
        miembro y parte del equipo, pero solo entrará a Admin si está enlazada aquí. Tras activar su
        contraseña, la persona podrá inscribir su app autenticadora desde Seguridad.
      </p>
    </div>
  );
}
