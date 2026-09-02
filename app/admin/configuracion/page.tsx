import { MessageSquareQuote, Settings, ShieldCheck, Users } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { MODULES } from "@/lib/app-settings";
import { getAppConfig } from "@/lib/app-settings-server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  BoardLabelsEditor,
  ConfigShortcuts,
  DashboardWidgetsEditor,
  RolePermissionsEditor,
} from "@/components/admin/ConfigEditors";
import { TeamManager } from "@/components/admin/TeamManager";
import { TeamColumnsEditor } from "@/components/admin/TeamColumnsEditor";
import { TestimonialsManager } from "@/components/admin/TestimonialsManager";
import { TotpManager } from "@/components/admin/TotpManager";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { MyPhotoUploader } from "@/components/admin/MyPhotoUploader";
import type { TeamMember, Testimonial } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Configuración" };

/**
 * Configuración (socios). Desde el 02-09 reúne lo que antes eran módulos
 * aparte: Equipo (con columnas configurables), Testimonios y Seguridad.
 */
export default async function ConfiguracionPage() {
  const me = await requireTeamMember(["socio"]);
  const supabase = await createClient();
  const service = createServiceClient();

  const [config, { data: teamData }, { data: testimonialsData }] = await Promise.all([
    getAppConfig(),
    supabase.from("team_members").select("*").order("role").order("full_name"),
    supabase.from("testimonials").select("*").order("sort_order").order("created_at", { ascending: false }),
  ]);
  const team = (teamData ?? []) as TeamMember[];
  const testimonials = (testimonialsData ?? []) as Testimonial[];

  // Fotos del equipo: URLs firmadas de corta vida desde el bucket privado.
  const photoUrls: Record<string, string> = {};
  await Promise.all(
    team.filter((p) => p.photo_path).map(async (p) => {
      const { data: signed } = await service.storage.from("team-photos").createSignedUrl(p.photo_path!, 600);
      if (signed?.signedUrl) photoUrls[p.id] = signed.signedUrl;
    })
  );

  const sectionHead = (Icon: typeof Users, title: string, hint: string, id: string) => (
    <div id={id} className="scroll-mt-6">
      <h2 className="flex items-center gap-2 font-heading text-2xl font-extrabold text-white">
        <Icon className="h-5 w-5 text-stride-cyan" /> {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-white/50">{hint}</p>
    </div>
  );

  return (
    <div className="space-y-10">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
          <Settings className="h-3.5 w-3.5" /> Configuración
        </p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">El sistema, a tu medida</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          Qué ve cada rol, qué muestra el dashboard, el equipo, los testimonios de la web y tu seguridad.
          Los cambios aplican al tiro para todo el equipo.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2 text-xs">
          {[["#permisos", "Permisos y tableros"], ["#equipo", "Equipo"], ["#testimonios", "Testimonios"], ["#seguridad", "Seguridad"]].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-white/60 hover:text-white">{label}</a>
          ))}
        </nav>
      </header>

      <section className="space-y-6">
        {sectionHead(Settings, "Permisos y tableros", "Qué módulos ve cada rol y cómo se llaman las columnas.", "permisos")}
        <ConfigShortcuts />
        <RolePermissionsEditor modules={MODULES} initialHidden={config.hiddenModules} />
        <DashboardWidgetsEditor initial={config.widgets} />
        <div className="grid gap-6 lg:grid-cols-2">
          <BoardLabelsEditor kind="task_labels" title="Columnas de Tareas" initial={config.taskLabels} />
          <BoardLabelsEditor kind="lead_labels" title="Columnas de Leads" initial={config.leadLabels} />
        </div>
      </section>

      <section className="space-y-6">
        {sectionHead(Users, "Equipo", `${team.length} personas. Pincha la foto para cambiarla; "Dar acceso" envía la invitación al correo de cada una.`, "equipo")}
        <TeamColumnsEditor initial={config.teamColumns} />
        <TeamManager team={team} photoUrls={photoUrls} currentMemberId={me.id} columns={config.teamColumns} />
      </section>

      <section className="space-y-6">
        {sectionHead(MessageSquareQuote, "Testimonios", `${testimonials.length} en total · ${testimonials.filter((t) => t.published).length} publicados en la landing.`, "testimonios")}
        <TestimonialsManager testimonials={testimonials} canDelete />
      </section>

      <section className="space-y-6">
        {sectionHead(ShieldCheck, "Tu seguridad", "Foto, segundo factor y contraseña de tu propia cuenta. El resto del equipo lo maneja desde \"Mi acceso\" en el menú.", "seguridad")}
        <MyPhotoUploader photoUrl={photoUrls[me.id] ?? null} name={me.nickname ?? me.full_name} />
        <TotpManager accountEmail={me.email} />
        <ChangePasswordForm />
      </section>
    </div>
  );
}
