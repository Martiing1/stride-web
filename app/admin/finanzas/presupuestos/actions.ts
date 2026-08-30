"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface BudgetResult {
  ok: boolean;
  error?: string;
}

const BudgetSchema = z.object({
  year: z.coerce.number().int().min(2024).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  category: z.string().trim().min(2).max(60),
  kind: z.enum(["ingreso", "gasto"]),
  planned_clp: z.coerce.number().int().min(0).max(500_000_000),
});

/** Crea o actualiza la meta del mes para una categoría (upsert por mes+categoría+tipo). */
export async function saveBudget(formData: FormData): Promise<BudgetResult> {
  await requireTeamMember(["socio"]);

  const parsed = BudgetSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    category: formData.get("category"),
    kind: formData.get("kind") ?? "gasto",
    planned_clp: formData.get("planned_clp"),
  });
  if (!parsed.success) return { ok: false, error: "Revisa los campos del presupuesto." };

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .upsert(
      { ...d, category: d.category.toLowerCase() },
      { onConflict: "year,month,category,kind" }
    );
  if (error) return { ok: false, error: "No se pudo guardar. ¿Corriste la migración 006?" };

  revalidatePath("/admin/finanzas/presupuestos");
  return { ok: true };
}

export async function deleteBudget(formData: FormData): Promise<BudgetResult> {
  await requireTeamMember(["socio"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Presupuesto inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id.data);
  if (error) return { ok: false, error: "No se pudo borrar." };

  revalidatePath("/admin/finanzas/presupuestos");
  return { ok: true };
}
