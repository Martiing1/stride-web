import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TestimonialsManager } from "@/components/admin/TestimonialsManager";
import type { Testimonial } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Testimonios" };

export default async function TestimoniosPage() {
  const member = await requireTeamMember(["socio", "lider_comunidad"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("testimonials")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });
  const testimonials = (data ?? []) as Testimonial[];

  const publicados = testimonials.filter((t) => t.published).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Testimonios</h1>
        <p className="mt-1 text-white/50">
          {testimonials.length} en total · {publicados} publicados en la landing
        </p>
      </header>

      <TestimonialsManager testimonials={testimonials} canDelete={member.role === "socio"} />
    </div>
  );
}
