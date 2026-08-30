"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface TestimonialResult {
  ok: boolean;
  error?: string;
}

const TestimonialSchema = z.object({
  author_name: z.string().trim().min(2, "Falta el nombre de quien lo dice").max(120),
  author_role: z.string().trim().max(120),
  quote: z.string().trim().min(10, "El testimonio es muy corto").max(600),
  photo_url: z.string().trim().url("Link de foto inválido").max(500).or(z.literal("")),
  rating: z.string().max(1),
  sort_order: z.string().max(4),
});

function toRow(d: z.infer<typeof TestimonialSchema>) {
  return {
    author_name: d.author_name,
    author_role: d.author_role || null,
    quote: d.quote,
    photo_url: d.photo_url || null,
    rating: d.rating ? Number(d.rating) : null,
    sort_order: d.sort_order ? Number(d.sort_order) : 0,
  };
}

function parse(formData: FormData) {
  return TestimonialSchema.safeParse({
    author_name: formData.get("author_name"),
    author_role: formData.get("author_role") ?? "",
    quote: formData.get("quote") ?? "",
    photo_url: formData.get("photo_url") ?? "",
    rating: formData.get("rating") ?? "",
    sort_order: formData.get("sort_order") ?? "",
  });
}

function refresh() {
  revalidatePath("/admin/testimonios");
  revalidatePath("/");
}

export async function createTestimonial(formData: FormData): Promise<TestimonialResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").insert(toRow(parsed.data));
  if (error) return { ok: false, error: "No se pudo crear el testimonio." };

  refresh();
  return { ok: true };
}

export async function updateTestimonial(formData: FormData): Promise<TestimonialResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Testimonio inválido" };

  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").update(toRow(parsed.data)).eq("id", id.data);
  if (error) return { ok: false, error: "No se pudo guardar el testimonio." };

  refresh();
  return { ok: true };
}

/** Publicar es una decisión editorial aparte de escribirlo: la landing solo muestra los publicados. */
export async function setTestimonialPublished(formData: FormData): Promise<TestimonialResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = z
    .object({ id: z.string().uuid(), published: z.enum(["true", "false"]) })
    .safeParse({ id: formData.get("id"), published: formData.get("published") });
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("testimonials")
    .update({ published: parsed.data.published === "true" })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: "No se pudo cambiar el estado." };

  refresh();
  return { ok: true };
}

export async function deleteTestimonial(formData: FormData): Promise<TestimonialResult> {
  await requireTeamMember(["socio"]);

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Testimonio inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").delete().eq("id", id.data);
  if (error) return { ok: false, error: "No se pudo borrar." };

  refresh();
  return { ok: true };
}
