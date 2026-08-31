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
export async function updateTaskStatus(formData: FormData) {
  await requireTeamMember();

  const parsed = UpdateStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

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
  await requireTeamMember();

  const parsed = NotesSchema.safeParse({
    id: formData.get("id"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ description: parsed.data.description || null })
    .eq("id", parsed.data.id);
  // RLS decide: staff edita todas; un monitor, las suyas.
  if (error) return { ok: false, error: "No se pudo guardar la nota." };

  revalidatePath("/admin/tareas");
  return { ok: true };
}
