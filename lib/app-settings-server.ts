import { createClient } from "./supabase/server";
import {
  DASHBOARD_WIDGETS,
  DEFAULT_LEAD_LABELS,
  DEFAULT_TASK_LABELS,
  DEFAULT_WIDGETS,
  type AppConfig,
  type WidgetId,
} from "./app-settings";

/**
 * Lee la configuración del sistema (tabla app_settings). Vive aparte de las
 * constantes porque usa cookies de sesión (solo servidor); los componentes de
 * cliente importan lib/app-settings, que es puro.
 */
export async function getAppConfig(): Promise<AppConfig> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("key, value");

  const map = new Map<string, unknown>();
  if (!error) for (const row of data ?? []) map.set(row.key, row.value);

  const widgets = Array.isArray(map.get("dashboard_widgets"))
    ? (map.get("dashboard_widgets") as string[]).filter((w): w is WidgetId =>
        DASHBOARD_WIDGETS.some((d) => d.id === w)
      )
    : DEFAULT_WIDGETS;

  return {
    hiddenModules: (map.get("role_modules") as AppConfig["hiddenModules"]) ?? {},
    widgets: widgets.length ? widgets : DEFAULT_WIDGETS,
    leadLabels: { ...DEFAULT_LEAD_LABELS, ...((map.get("lead_labels") as Record<string, string>) ?? {}) },
    taskLabels: { ...DEFAULT_TASK_LABELS, ...((map.get("task_labels") as Record<string, string>) ?? {}) },
  };
}
