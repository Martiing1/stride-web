"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface ChecklistResult {
  ok: boolean;
  error?: string;
  created?: number;
}

const MonthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Mes inválido");

/**
 * Crea los ítems del mes a partir de la plantilla.
 * La función SQL es idempotente: llamarla otra vez tras agregar un ítem nuevo
 * a la plantilla completa lo que falta, sin duplicar lo que ya está.
 */
export async function generateMonth(formData: FormData): Promise<ChecklistResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const month = MonthSchema.safeParse(formData.get("month"));
  if (!month.success) return { ok: false, error: "Mes inválido" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_month_checklist", {
    target_month: `${month.data}-01`,
  });

  if (error) return { ok: false, error: "No se pudo generar el checklist." };

  revalidatePath("/admin/membresia");
  return { ok: true, created: (data as number) ?? 0 };
}

const ToggleSchema = z.object({
  id: z.string().uuid(),
  done: z.enum(["true", "false"]),
});

export async function toggleItem(formData: FormData): Promise<ChecklistResult> {
  const member = await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = ToggleSchema.safeParse({
    id: formData.get("id"),
    done: formData.get("done"),
  });
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const done = parsed.data.done === "true";
  const supabase = await createClient();

  const { error } = await supabase
    .from("membership_month_items")
    .update({
      done,
      // Al desmarcar se limpia la firma: si no, quedaría diciendo que alguien
      // lo completó cuando ya no está completo.
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? member.id : null,
    })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: "No se pudo actualizar." };

  revalidatePath("/admin/membresia");
  return { ok: true };
}

const ItemSchema = z.object({
  month: MonthSchema,
  title: z.string().trim().min(3, "Describe el ítem").max(200),
  category: z.string().trim().max(60),
  assignee_id: z.string().uuid().or(z.literal("")),
  assignee_label: z.string().trim().max(80),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  notes: z.string().trim().max(500),
});

/** Ítem suelto, solo para ese mes: no entra a la plantilla. */
export async function addItem(formData: FormData): Promise<ChecklistResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = ItemSchema.safeParse({
    month: formData.get("month"),
    title: formData.get("title"),
    category: formData.get("category") ?? "",
    assignee_id: formData.get("assignee_id") ?? "",
    assignee_label: formData.get("assignee_label") ?? "",
    due_date: formData.get("due_date") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("membership_month_items").insert({
    month: `${d.month}-01`,
    title: d.title,
    category: d.category || null,
    assignee_id: d.assignee_id || null,
    assignee_label: d.assignee_id ? null : (d.assignee_label || null),
    due_date: d.due_date || null,
    notes: d.notes || null,
    sort_order: 999,
  });

  if (error) return { ok: false, error: "No se pudo agregar el ítem." };

  revalidatePath("/admin/membresia");
  return { ok: true };
}

const EditSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  notes: z.string().trim().max(500),
  assignee_id: z.string().uuid().or(z.literal("")),
  assignee_label: z.string().trim().max(80),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
});

export async function editItem(formData: FormData): Promise<ChecklistResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = EditSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    notes: formData.get("notes") ?? "",
    assignee_id: formData.get("assignee_id") ?? "",
    assignee_label: formData.get("assignee_label") ?? "",
    due_date: formData.get("due_date") ?? "",
  });

  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("membership_month_items")
    .update({
      title: d.title,
      notes: d.notes || null,
      assignee_id: d.assignee_id || null,
      assignee_label: d.assignee_id ? null : (d.assignee_label || null),
      due_date: d.due_date || null,
    })
    .eq("id", d.id);

  if (error) return { ok: false, error: "No se pudo guardar." };

  revalidatePath("/admin/membresia");
  return { ok: true };
}

export async function deleteItem(formData: FormData): Promise<ChecklistResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Ítem inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("membership_month_items").delete().eq("id", id.data);

  if (error) return { ok: false, error: "No se pudo eliminar." };

  revalidatePath("/admin/membresia");
  return { ok: true };
}
