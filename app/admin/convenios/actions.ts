"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface BenefitResult {
  ok: boolean;
  error?: string;
}

const BenefitSchema = z.object({
  business_name: z.string().trim().min(2, "Ponle el nombre del comercio").max(150),
  category: z.string().trim().min(2, "Indica la categoría").max(60),
  description: z.string().trim().min(3, "Describe el beneficio").max(600),
  discount_label: z.string().trim().max(40),
  address: z.string().trim().max(200),
  instagram: z.string().trim().max(80),
  sort_order: z.string().max(4),
});

/** Todo lo visible en /one y en el carnet sale de acá: se limpia antes de guardar. */
function toRow(d: z.infer<typeof BenefitSchema>) {
  return {
    business_name: d.business_name,
    category: d.category.toLowerCase(),
    description: d.description,
    discount_label: d.discount_label || null,
    address: d.address || null,
    // Se guarda sin arroba: la web la agrega al mostrarlo.
    instagram: d.instagram ? d.instagram.replace(/^@/, "") : null,
    sort_order: d.sort_order ? Number(d.sort_order) : 0,
  };
}

function parse(formData: FormData) {
  return BenefitSchema.safeParse({
    business_name: formData.get("business_name"),
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? "",
    discount_label: formData.get("discount_label") ?? "",
    address: formData.get("address") ?? "",
    instagram: formData.get("instagram") ?? "",
    sort_order: formData.get("sort_order") ?? "",
  });
}

/** Un convenio cambia lo que ven miembros y comercios, así que se revalida todo. */
function refresh() {
  revalidatePath("/admin/convenios");
  revalidatePath("/one");
  revalidatePath("/miembros");
}

export async function createBenefit(formData: FormData): Promise<BenefitResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("benefits").insert(toRow(parsed.data));
  if (error) return { ok: false, error: "No se pudo crear el convenio." };

  refresh();
  return { ok: true };
}

export async function updateBenefit(formData: FormData): Promise<BenefitResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Convenio inválido" };

  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("benefits").update(toRow(parsed.data)).eq("id", id.data);
  if (error) return { ok: false, error: "No se pudo guardar el convenio." };

  refresh();
  return { ok: true };
}

/**
 * Activar o desactivar en vez de borrar: los escaneos y el historial del
 * convenio siguen sirviendo aunque el comercio ya no esté vigente.
 */
export async function setBenefitActive(formData: FormData): Promise<BenefitResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = z
    .object({ id: z.string().uuid(), active: z.enum(["true", "false"]) })
    .safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("benefits")
    .update({ active: parsed.data.active === "true" })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudo cambiar el estado." };

  refresh();
  return { ok: true };
}
