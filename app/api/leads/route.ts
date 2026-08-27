import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyNewLead } from "@/lib/resend";

const LeadSchema = z.object({
  full_name: z.string().trim().min(2, "Nombre muy corto").max(120),
  email: z.string().trim().email("Email inválido").max(160),
  whatsapp: z.string().trim().min(8, "WhatsApp inválido").max(30),
  motivation: z.enum(["social_run", "constancia", "membresia"], {
    message: "Cuéntanos qué te trae a STRIDE",
  }),
  contact_consent: z.literal(true, {
    message: "Necesitamos tu autorización para responderte",
  }),
  marketing_consent: z.boolean().default(false),
  consent_version: z.string().trim().min(1).max(30),
  source: z.string().max(60).optional(),
  // Campo trampa: los bots lo rellenan, las personas no lo ven.
  website: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = LeadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { website, ...lead } = parsed.data;

  // Bot detectado: se responde ok para no darle pistas, pero no se guarda nada.
  if (website) return NextResponse.json({ ok: true });

  const supabase = createServiceClient();
  const { error } = await supabase.from("leads").insert({
    full_name: lead.full_name,
    email: lead.email,
    whatsapp: lead.whatsapp,
    motivation: lead.motivation,
    source: lead.source ?? "landing",
    contact_consent: lead.contact_consent,
    marketing_consent: lead.marketing_consent,
    consent_version: lead.consent_version,
    consented_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: "No pudimos guardar tus datos" }, { status: 500 });
  }

  // El correo es un extra: si Resend falla, el lead ya está guardado y visible
  // en el ERP, así que no se le muestra un error a la persona.
  try {
    await notifyNewLead(lead);
  } catch (err) {
    console.error("Fallo al notificar lead por email:", err);
  }

  return NextResponse.json({ ok: true });
}
