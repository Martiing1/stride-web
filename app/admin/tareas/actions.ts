"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pendiente", "en_progreso", "hecha", "recurrente", "bloqueada"]),
});

/**
 * Cambia el estado de una tarea.
 *
 * No se valida el rol acá a propósito: las políticas RLS ya permiten que un
 * monitor actualice solo las tareas donde es responsable, y que socios y
 * líderes actualicen cualquiera. Así la regla vive en un solo lugar.
 */
/** Etiquetas humanas de los campos auditados. */
const FIELD_LABELS: Record<string, string> = {
  title: "título",
  assignee_id: "responsable",
  area: "área",
  priority: "prioridad",
  due_date: "fecha límite",
  status: "estado",
  visibility: "visibilidad",
  description: "notas",
};

/**
 * Registra qué cambió en una tarea. Si la tabla de historial aún no existe
 * (migración 009 sin correr), el cambio se hace igual y el registro se omite.
 */
async function logTaskChanges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memberId: string,
  taskId: string,
  changes: Array<{ field: string; old: string | null; next: string | null }>
) {
  const rows = changes
    .filter((c) => (c.old ?? "") !== (c.next ?? ""))
    .map((c) => ({
      task_id: taskId,
      changed_by: memberId,
      field: FIELD_LABELS[c.field] ?? c.field,
      old_value: c.old,
      new_value: c.next,
    }));
  if (rows.length) await supabase.from("task_audit_log").insert(rows);
}

export async function updateTaskStatus(formData: FormData) {
  const member = await requireTeamMember();

  const parsed = UpdateStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("tasks")
    .select("status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const { error } = await supabase
    .from("tasks")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (!error && before) {
    await logTaskChanges(supabase, member.id, parsed.data.id, [
      { field: "status", old: before.status, next: parsed.data.status },
    ]);
  }

  if (error) {
    return { ok: false, error: "No se pudo actualizar (¿es tuya esta tarea?)" };
  }

  revalidatePath("/admin/tareas");
  revalidatePath("/admin");
  return { ok: true };
}

const NewTaskSchema = z.object({
  title: z.string().trim().min(3, "Describe la tarea").max(300),
  assignee_id: z.string().uuid().or(z.literal("")),
  area: z.string().trim().max(100),
  priority: z.enum(["alta", "media", "baja"]),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
});

export async function createTask(formData: FormData) {
  const member = await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = NewTaskSchema.safeParse({
    title: formData.get("title"),
    assignee_id: formData.get("assignee_id") ?? "",
    area: formData.get("area") ?? "",
    priority: formData.get("priority") ?? "media",
    due_date: formData.get("due_date") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const d = parsed.data;
  // "Solo socios" únicamente la puede marcar un socio; nadie más la vería igual.
  const visibility = formData.get("visibility") === "socios" && member.role === "socio" ? "socios" : "equipo";
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").insert({
    title: d.title,
    assignee_id: d.assignee_id || null,
    area: d.area || null,
    priority: d.priority,
    due_date: d.due_date || null,
    status: "pendiente",
    visibility,
  });

  if (error) return { ok: false, error: "No se pudo crear la tarea." };

  revalidatePath("/admin/tareas");
  revalidatePath("/admin");
  return { ok: true };
}

const NotesSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().max(3000),
});

/** Notas de la tarea: contexto, avances, links. Se editan desde el popup. */
export async function updateTaskNotes(formData: FormData) {
  const member = await requireTeamMember();

  const parsed = NotesSchema.safeParse({
    id: formData.get("id"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("tasks")
    .select("description")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const { error } = await supabase
    .from("tasks")
    .update({ description: parsed.data.description || null })
    .eq("id", parsed.data.id);
  // RLS decide: staff edita todas; un monitor, las suyas.
  if (error) return { ok: false, error: "No se pudo guardar la nota." };
  if (before) {
    await logTaskChanges(supabase, member.id, parsed.data.id, [
      { field: "description", old: before.description, next: parsed.data.description || null },
    ]);
  }

  revalidatePath("/admin/tareas");
  return { ok: true };
}

const EditTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(3, "Describe la tarea").max(300),
  assignee_id: z.string().uuid().or(z.literal("")),
  area: z.string().trim().max(100),
  priority: z.enum(["alta", "media", "baja"]),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  visibility: z.enum(["equipo", "socios"]),
});

/**
 * Edición completa de la tarjeta después de creada. Cada parámetro que cambie
 * queda en el historial con quién y cuándo. La visibilidad solo la puede
 * cambiar un socio; RLS respalda todo por abajo.
 */
export async function updateTask(formData: FormData) {
  const member = await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = EditTaskSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    assignee_id: formData.get("assignee_id") ?? "",
    area: formData.get("area") ?? "",
    priority: formData.get("priority") ?? "media",
    due_date: formData.get("due_date") ?? "",
    visibility: formData.get("visibility") ?? "equipo",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const d = parsed.data;
  const supabase = await createClient();
  const { data: before } = await supabase.from("tasks").select("*").eq("id", d.id).maybeSingle();
  if (!before) return { ok: false, error: "La tarea ya no existe (o no la puedes ver)." };

  // Solo un socio mueve la visibilidad; para el resto se conserva la actual.
  const visibility = member.role === "socio" ? d.visibility : (before.visibility ?? "equipo");

  const next = {
    title: d.title,
    assignee_id: d.assignee_id || null,
    area: d.area || null,
    priority: d.priority,
    due_date: d.due_date || null,
    visibility,
  };
  const { error } = await supabase.from("tasks").update(next).eq("id", d.id);
  if (error) return { ok: false, error: "No se pudo guardar la tarea." };

  // Nombres legibles para el historial de responsable.
  const { data: team } = await supabase.from("team_members").select("id, full_name, nickname");
  const personName = (id: string | null) => {
    if (!id) return null;
    const p = (team ?? []).find((t) => t.id === id);
    return p ? (p.nickname ?? p.full_name) : id;
  };

  await logTaskChanges(supabase, member.id, d.id, [
    { field: "title", old: before.title, next: next.title },
    { field: "assignee_id", old: personName(before.assignee_id), next: personName(next.assignee_id) },
    { field: "area", old: before.area, next: next.area },
    { field: "priority", old: before.priority, next: next.priority },
    { field: "due_date", old: before.due_date, next: next.due_date },
    { field: "visibility", old: before.visibility ?? "equipo", next: visibility },
  ]);

  revalidatePath("/admin/tareas");
  revalidatePath("/admin");
  return { ok: true };
}

export interface TaskHistoryEntry {
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  who: string;
}

/** Historial de una tarea, con nombres en vez de ids. */
export async function getTaskHistory(formData: FormData): Promise<{ ok: boolean; entries: TaskHistoryEntry[] }> {
  await requireTeamMember();

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, entries: [] };

  const supabase = await createClient();
  const [{ data: log, error }, { data: team }] = await Promise.all([
    supabase
      .from("task_audit_log")
      .select("field, old_value, new_value, created_at, changed_by")
      .eq("task_id", id.data)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("team_members").select("id, full_name, nickname"),
  ]);
  // Migración 009 sin correr: sin historial, sin drama.
  if (error) return { ok: true, entries: [] };

  const nameOf = (uid: string | null) => {
    const p = (team ?? []).find((t) => t.id === uid);
    return p ? (p.nickname ?? p.full_name) : "—";
  };
  return {
    ok: true,
    entries: (log ?? []).map((entry) => ({
      field: entry.field,
      old_value: entry.old_value,
      new_value: entry.new_value,
      created_at: entry.created_at,
      who: nameOf(entry.changed_by),
    })),
  };
}

/**
 * Eliminar una tarea de verdad: solo socios. Para el resto existe "hecha" y
 * el archivo. El historial de la tarea cae en cascada junto con ella.
 */
export async function deleteTask(formData: FormData) {
  await requireTeamMember(["socio"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Tarea inválida" };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id.data);
  if (error) return { ok: false, error: "No se pudo eliminar la tarea." };

  revalidatePath("/admin/tareas");
  revalidatePath("/admin");
  return { ok: true };
}
