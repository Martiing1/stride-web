import { requireTeamMember, isCurrentUserOwner } from "@/lib/auth";
import { visibleModules } from "@/lib/app-settings";
import { getAppConfig } from "@/lib/app-settings-server";
import { createServiceClient } from "@/lib/supabase/server";
import type { SidebarGroup } from "@/components/admin/Sidebar";
import { getPendingEvaluations } from "@/lib/evaluations";
import { Sidebar } from "@/components/admin/Sidebar";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { EvaluationGate } from "@/components/admin/EvaluationGate";
import { THEME_BOOT_SCRIPT } from "@/components/admin/ThemeToggle";
import { headers } from "next/headers";

export const metadata = {
  title: "ERP STRIDE",
  robots: { index: false, follow: false },
};

/**
 * Layout del ERP. El middleware ya garantizó que hay sesión; acá se resuelve la
 * persona del equipo y su rol, que determina qué se ve en la navegación.
 *
 * /admin/login y /admin/activar también heredan este layout padre, por lo que
 * se excluyen abajo antes de exigir sesión.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-stride-pathname");

  // Los layouts de App Router siempre envuelven a sus rutas hijas. Por eso el
  // layout propio de /admin/login no reemplaza este layout padre: hay que
  // excluir el login explícitamente antes de exigir una sesión.
  if (pathname?.startsWith("/admin/login") || pathname?.startsWith("/admin/activar")) {
    return <>{children}</>;
  }

  const member = await requireTeamMember();

  // Todo lo demás del layout va en paralelo: cada navegación del ERP pasa por
  // acá, y encadenar estas consultas era lo que hacía lento cambiar de módulo.
  // Ninguna de estas consultas puede tumbar el ERP entero: si una falla
  // (red, Supabase caído), el panel carga con su valor por defecto.
  const [isOwner, pendingEvaluations, config, photoUrl] = await Promise.all([
    isCurrentUserOwner().catch(() => false),
    getPendingEvaluations(member.id).catch(() => []),
    getAppConfig(),
    member.photo_path
      ? createServiceClient()
          .storage.from("team-photos")
          .createSignedUrl(member.photo_path, 600)
          .then(({ data }) => data?.signedUrl ?? null)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  // Bloqueo post social run (30-08, ajustado 02-09): con una evaluación
  // pendiente aparece un popup sobre TODO el ERP que no se puede cerrar hasta
  // entregarla. Individual: cada uno destraba el suyo al responder.
  const gate = pendingEvaluations[0] ?? null;

  // Módulos visibles: techo del código + lo que la configuración oculta por rol.
  const modules = visibleModules(member.role, isOwner, config);
  const groups: SidebarGroup[] = [];
  for (const mod of modules) {
    const group = groups.find((g) => g.section === mod.section);
    if (group) group.items.push({ href: mod.href, label: mod.label });
    else groups.push({ section: mod.section, items: [{ href: mod.href, label: mod.label }] });
  }



  return (
    <div className="flex min-h-dvh flex-col bg-stride-bg lg:flex-row">
      {/* Aplica el tema guardado antes del primer pintado (evita el destello). */}
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      <Sidebar
        role={member.role}
        name={member.nickname ?? member.full_name}
        photoUrl={photoUrl}
        groups={groups}
        onSignOut={<SignOutButton />}
      />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
      </div>
      {gate && <EvaluationGate event={gate} pendingCount={pendingEvaluations.length} />}
    </div>
  );
}
