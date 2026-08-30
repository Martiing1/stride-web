import { Settings } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { MODULES } from "@/lib/app-settings";
import { getAppConfig } from "@/lib/app-settings-server";
import {
  BoardLabelsEditor,
  ConfigShortcuts,
  DashboardWidgetsEditor,
  RolePermissionsEditor,
} from "@/components/admin/ConfigEditors";

export const dynamic = "force-dynamic";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  await requireTeamMember(["socio"]);
  const config = await getAppConfig();

  return (
    <div className="space-y-8">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
          <Settings className="h-3.5 w-3.5" /> Configuración
        </p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">El sistema, a tu medida</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          Qué ve cada rol, qué muestra el dashboard y cómo se llaman las columnas de los
          tableros. Los cambios aplican al tiro para todo el equipo.
        </p>
      </header>

      <ConfigShortcuts />
      <RolePermissionsEditor modules={MODULES} initialHidden={config.hiddenModules} />
      <DashboardWidgetsEditor initial={config.widgets} />
      <div className="grid gap-6 lg:grid-cols-2">
        <BoardLabelsEditor kind="task_labels" title="Columnas de Tareas" initial={config.taskLabels} />
        <BoardLabelsEditor kind="lead_labels" title="Columnas de Leads" initial={config.leadLabels} />
      </div>
    </div>
  );
}
