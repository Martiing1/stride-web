"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_WIDGETS, MODULES } from "@/lib/app-settings";

export interface ConfigResult {
  ok: boolean;
  error?: string;
}

/** Guarda una clave de configuración. Solo socios; RLS lo respalda. */
async function saveSetting(key: string, value: unknown): Promise<ConfigResult> {
  const member = await requireTeamMember(["socio"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_by: member.id, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: "No se pudo guardar. ¿Corriste la migración 005?" };

  // La configuración afecta al sidebar de todo el ERP.
  revalidatePath("/admin", "layout");
  return { ok: true };
}

const RoleModulesSchema = z.object({
  lider_comunidad: z.array(z.string()).max(40),
  monitor: z.array(z.string()).max(40),
});

/** Qué módulos se le OCULTAN a cada rol (dentro del techo que permite el código). */
export async function saveRoleModules(formData: FormData): Promise<ConfigResult> {
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Datos inválidos" };
  }
  const parsed = RoleModulesSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  // Solo hrefs reales y ocultables: lo demás se descarta en silencio.
  const hideable = new Set(MODULES.filter((m) => !m.fixed).map((m) => m.href));
  const clean = {
    lider_comunidad: parsed.data.lider_comunidad.filter((h) => hideable.has(h)),
    monitor: parsed.data.monitor.filter((h) => hideable.has(h)),
  };
  return saveSetting("role_modules", clean);
}

export async function saveDashboardWidgets(formData: FormData): Promise<ConfigResult> {
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Datos inválidos" };
  }
  const valid = new Set(DASHBOARD_WIDGETS.map((w) => w.id));
  const parsed = z.array(z.string()).max(12).safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const widgets = parsed.data.filter((w) => valid.has(w as never));
  if (widgets.length === 0) return { ok: false, error: "Deja al menos un widget activo." };
  return saveSetting("dashboard_widgets", widgets);
}

const LabelsSchema = z.record(z.string(), z.string().trim().min(1).max(40));

export async function saveBoardLabels(formData: FormData): Promise<ConfigResult> {
  const kind = formData.get("kind");
  if (kind !== "lead_labels" && kind !== "task_labels") return { ok: false, error: "Datos inválidos" };
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Datos inválidos" };
  }
  const parsed = LabelsSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Los nombres no pueden quedar vacíos." };
  const result = await saveSetting(kind, parsed.data);
  if (result.ok) {
    revalidatePath("/admin/leads");
    revalidatePath("/admin/tareas");
  }
  return result;
}
