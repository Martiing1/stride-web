"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface CategoryResult {
  ok: boolean;
  error?: string;
}

const CreateSchema = z.object({
  kind: z.enum(["ingreso", "costo", "gasto"]),
  name: z.string().trim().min(2, "Nombre muy corto").max(60),
  parent_id: z.string().uuid().or(z.literal("")),
});

export async function createCategory(formData: FormData): Promise<CategoryResult> {
  await requireTeamMember(["socio"]);

  const parsed = CreateSchema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    parent_id: formData.get("parent_id") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("finance_categories").insert({
    kind: parsed.data.kind,
    name: parsed.data.name,
    parent_id: parsed.data.parent_id || null,
  });
  if (error) return { ok: false, error: "No se pudo crear. ¿Ya existe con ese nombre?" };

  revalidatePath("/admin/finanzas/categorias");
  revalidatePath("/admin/finanzas");
  return { ok: true };
}

/**
 * Borrar una categoría no toca los movimientos ya registrados (guardan el
 * nombre como texto); solo deja de ofrecerse en el formulario. Las
 * subcategorías caen en cascada.
 */
export async function deleteCategory(formData: FormData): Promise<CategoryResult> {
  await requireTeamMember(["socio"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Categoría inválida" };

  const supabase = await createClient();
  const { error } = await supabase.from("finance_categories").delete().eq("id", id.data);
  if (error) return { ok: false, error: "No se pudo borrar." };

  revalidatePath("/admin/finanzas/categorias");
  revalidatePath("/admin/finanzas");
  return { ok: true };
}
