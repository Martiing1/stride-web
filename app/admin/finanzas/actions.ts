"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface FinanceResult {
  ok: boolean;
  error?: string;
}

const TxSchema = z.object({
  kind: z.enum(["ingreso", "gasto"]),
  amount_clp: z.string().min(1, "Falta el monto"),
  category: z.string().trim().min(2, "Falta la categoría").max(60),
  description: z.string().trim().max(300),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  event_id: z.string().uuid().or(z.literal("")),
  payment_method: z.string().trim().max(60),
  receipt_url: z.string().trim().max(500),
});

function toRow(d: z.infer<typeof TxSchema>) {
  return {
    kind: d.kind,
    // Se guarda en pesos enteros: el CLP no tiene decimales.
    amount_clp: Math.round(Number(d.amount_clp)),
    category: d.category,
    description: d.description || null,
    occurred_on: d.occurred_on,
    event_id: d.event_id || null,
    payment_method: d.payment_method || null,
    receipt_url: d.receipt_url || null,
  };
}

function parse(formData: FormData) {
  return TxSchema.safeParse({
    kind: formData.get("kind") ?? "gasto",
    amount_clp: formData.get("amount_clp") ?? "",
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? "",
    occurred_on: formData.get("occurred_on") ?? "",
    event_id: formData.get("event_id") ?? "",
    payment_method: formData.get("payment_method") ?? "",
    receipt_url: formData.get("receipt_url") ?? "",
  });
}

export async function createTransaction(formData: FormData): Promise<FinanceResult> {
  const member = await requireTeamMember(["socio"]);
  const parsed = parse(formData);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  if (!Number.isFinite(Number(parsed.data.amount_clp)) || Number(parsed.data.amount_clp) < 0) {
    return { ok: false, error: "El monto debe ser un número positivo." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .insert({ ...toRow(parsed.data), created_by: member.id });

  if (error) return { ok: false, error: "No se pudo registrar el movimiento." };

  revalidatePath("/admin/finanzas");
  return { ok: true };
}

export async function updateTransaction(formData: FormData): Promise<FinanceResult> {
  await requireTeamMember(["socio"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Movimiento inválido" };

  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("transactions").update(toRow(parsed.data)).eq("id", id.data);

  if (error) return { ok: false, error: "No se pudo guardar." };

  revalidatePath("/admin/finanzas");
  return { ok: true };
}

export async function deleteTransaction(formData: FormData): Promise<FinanceResult> {
  await requireTeamMember(["socio"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Movimiento inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id.data);

  if (error) return { ok: false, error: "No se pudo eliminar." };

  revalidatePath("/admin/finanzas");
  return { ok: true };
}
