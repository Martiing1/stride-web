"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface KitResult {
  ok: boolean;
  error?: string;
}

const ItemSchema = z.object({
  name: z.string().trim().min(2, "Ponle nombre al artículo").max(120),
  category: z.string().trim().max(60),
  size: z.string().trim().max(20),
  stock: z.string().max(6),
  unit_cost_clp: z.string().max(9),
});

function itemRow(d: z.infer<typeof ItemSchema>) {
  return {
    name: d.name,
    category: d.category || null,
    // Talla vacía = artículo sin tallas (medalla, sticker), no talla "".
    size: d.size || null,
    stock: d.stock ? Number(d.stock) : 0,
    unit_cost_clp: d.unit_cost_clp ? Number(d.unit_cost_clp) : null,
  };
}

function parseItem(formData: FormData) {
  return ItemSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category") ?? "",
    size: formData.get("size") ?? "",
    stock: formData.get("stock") ?? "0",
    unit_cost_clp: formData.get("unit_cost_clp") ?? "",
  });
}

export async function createInventoryItem(formData: FormData): Promise<KitResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const parsed = parseItem(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert(itemRow(parsed.data));
  if (error) return { ok: false, error: "No se pudo crear el artículo." };

  revalidatePath("/admin/kits");
  return { ok: true };
}

export async function updateInventoryItem(formData: FormData): Promise<KitResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Artículo inválido" };

  const parsed = parseItem(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").update(itemRow(parsed.data)).eq("id", id.data);
  if (error) return { ok: false, error: "No se pudo guardar el artículo." };

  revalidatePath("/admin/kits");
  return { ok: true };
}

/**
 * Suma o resta stock sin reescribir la ficha.
 *
 * Se lee el valor actual y se guarda el nuevo en vez de un `stock + n` en SQL:
 * así el ajuste nunca deja el stock en negativo por un doble clic.
 */
export async function adjustStock(formData: FormData): Promise<KitResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = z
    .object({ id: z.string().uuid(), delta: z.coerce.number().int().min(-999).max(999) })
    .safeParse({ id: formData.get("id"), delta: formData.get("delta") });
  if (!parsed.success) return { ok: false, error: "Ajuste inválido" };

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("inventory_items")
    .select("stock")
    .eq("id", parsed.data.id)
    .single();
  if (!item) return { ok: false, error: "No encontramos el artículo." };

  const next = Math.max(0, item.stock + parsed.data.delta);
  const { error } = await supabase.from("inventory_items").update({ stock: next }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudo ajustar el stock." };

  revalidatePath("/admin/kits");
  return { ok: true };
}

export async function deleteInventoryItem(formData: FormData): Promise<KitResult> {
  await requireTeamMember(["socio"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Artículo inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").delete().eq("id", id.data);
  // La FK de kit_deliveries es `on delete restrict`: si ya se entregó, no se borra.
  if (error) return { ok: false, error: "No se puede borrar: ya tiene entregas registradas. Déjalo en stock 0." };

  revalidatePath("/admin/kits");
  return { ok: true };
}

export async function createDelivery(formData: FormData): Promise<KitResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = z
    .object({
      member_id: z.string().uuid("Elige un miembro"),
      item_id: z.string().uuid("Elige un artículo"),
      quantity: z.coerce.number().int().min(1).max(50),
      notes: z.string().trim().max(300),
    })
    .safeParse({
      member_id: formData.get("member_id"),
      item_id: formData.get("item_id"),
      quantity: formData.get("quantity") ?? "1",
      notes: formData.get("notes") ?? "",
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("kit_deliveries").insert({
    member_id: parsed.data.member_id,
    item_id: parsed.data.item_id,
    quantity: parsed.data.quantity,
    notes: parsed.data.notes || null,
  });
  if (error) return { ok: false, error: "No se pudo registrar la entrega." };

  revalidatePath("/admin/kits");
  return { ok: true };
}

/**
 * Marca el kit como entregado y descuenta el stock en el mismo paso: son el
 * mismo hecho del mundo real y separarlos es lo que descuadra el inventario.
 */
export async function markDelivered(formData: FormData): Promise<KitResult> {
  const member = await requireTeamMember(["socio", "lider_comunidad"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Entrega inválida" };

  const supabase = await createClient();
  const { data: delivery } = await supabase
    .from("kit_deliveries")
    .select("id, item_id, quantity, status")
    .eq("id", id.data)
    .single();
  if (!delivery) return { ok: false, error: "No encontramos la entrega." };
  if (delivery.status === "entregado") return { ok: true };

  const { error } = await supabase
    .from("kit_deliveries")
    .update({
      status: "entregado",
      delivered_at: new Date().toISOString(),
      delivered_by: member.id,
    })
    .eq("id", delivery.id)
    // Solo descuenta si seguía pendiente: dos clics no descuentan dos veces.
    .eq("status", "pendiente");
  if (error) return { ok: false, error: "No se pudo marcar como entregada." };

  const { data: item } = await supabase
    .from("inventory_items")
    .select("stock")
    .eq("id", delivery.item_id)
    .single();
  if (item) {
    await supabase
      .from("inventory_items")
      .update({ stock: Math.max(0, item.stock - delivery.quantity) })
      .eq("id", delivery.item_id);
  }

  revalidatePath("/admin/kits");
  return { ok: true };
}

// ─── Paquetes (kit de inicio, kit aniversario…) ──────────────────────────────

const BundleSchema = z.object({
  name: z.string().trim().min(2, "Ponle nombre al paquete").max(120),
  notes: z.string().trim().max(300),
  items: z
    .array(z.object({ item_id: z.string().uuid(), quantity: z.number().int().min(1).max(50) }))
    .min(1, "Un paquete necesita al menos un artículo")
    .max(20),
});

/** Crea un paquete: un nombre + la lista de artículos que lo componen. */
export async function createBundle(formData: FormData): Promise<KitResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, error: "Datos inválidos" };
  }
  const parsed = BundleSchema.safeParse({
    name: formData.get("name"),
    notes: formData.get("notes") ?? "",
    items,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { data: bundle, error } = await supabase
    .from("kit_bundles")
    .insert({ name: parsed.data.name, notes: parsed.data.notes || null })
    .select("id")
    .single();
  if (error || !bundle) return { ok: false, error: "No se pudo crear. ¿Corriste la migración 006?" };

  const { error: itemsError } = await supabase
    .from("kit_bundle_items")
    .insert(parsed.data.items.map((i) => ({ bundle_id: bundle.id, ...i })));
  if (itemsError) {
    await supabase.from("kit_bundles").delete().eq("id", bundle.id);
    return { ok: false, error: "No se pudieron guardar los artículos del paquete." };
  }

  revalidatePath("/admin/kits");
  return { ok: true };
}

export async function deleteBundle(formData: FormData): Promise<KitResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Paquete inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("kit_bundles").delete().eq("id", id.data);
  if (error) return { ok: false, error: "No se pudo borrar el paquete." };

  revalidatePath("/admin/kits");
  return { ok: true };
}

/**
 * Entrega un paquete completo a un miembro: crea una entrega pendiente por
 * cada artículo del paquete. Marcarlas entregadas descuenta stock como siempre.
 */
export async function deliverBundle(formData: FormData): Promise<KitResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = z
    .object({ bundle_id: z.string().uuid("Elige un paquete"), member_id: z.string().uuid("Elige un miembro") })
    .safeParse({ bundle_id: formData.get("bundle_id"), member_id: formData.get("member_id") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const [{ data: bundle }, { data: items }] = await Promise.all([
    supabase.from("kit_bundles").select("name").eq("id", parsed.data.bundle_id).single(),
    supabase.from("kit_bundle_items").select("item_id, quantity").eq("bundle_id", parsed.data.bundle_id),
  ]);
  if (!bundle || !items?.length) return { ok: false, error: "El paquete no tiene artículos." };

  const { error } = await supabase.from("kit_deliveries").insert(
    items.map((i) => ({
      member_id: parsed.data.member_id,
      item_id: i.item_id,
      quantity: i.quantity,
      notes: `Paquete: ${bundle.name}`,
    }))
  );
  if (error) return { ok: false, error: "No se pudo registrar la entrega del paquete." };

  revalidatePath("/admin/kits");
  return { ok: true };
}
