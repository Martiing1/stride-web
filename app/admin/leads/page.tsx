import { UserPlus, Mail, MessageCircle } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MOTIVATION_LABELS, EXPERIENCE_LABELS } from "@/lib/lead-options";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  const leads = (data ?? []) as Lead[];
  const nuevos = leads.filter((l) => l.status === "nuevo").length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Leads</h1>
        <p className="mt-1 text-white/50">
          {leads.length} en total · {nuevos} sin contactar
        </p>
      </header>

      {leads.length > 0 ? (
        <section className="space-y-2">
          {leads.map((lead) => (
            <div key={lead.id} className="card flex flex-wrap items-center gap-4 py-4">
              <div className="min-w-[180px] flex-1">
                <p className="font-medium text-white">{lead.full_name}</p>
                <p className="mt-0.5 text-sm text-stride-cyan/80">
                  {MOTIVATION_LABELS[lead.motivation] ?? lead.motivation}
                </p>
                <p className="mt-0.5 text-xs text-white/40">
                  {lead.running_experience
                    ? `${EXPERIENCE_LABELS[lead.running_experience]} · `
                    : ""}
                  {new Date(lead.created_at).toLocaleDateString("es-CL", {
                    timeZone: "America/Santiago",
                  })}
                  {lead.source !== "landing" && ` · ${lead.source}`}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <a
                  href={`https://wa.me/${lead.whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                    `¡Hola ${lead.full_name.split(" ")[0]}! Te escribimos de STRIDE 🏃`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp de ${lead.full_name}`}
                  className="rounded-lg border border-white/10 p-2 text-white/50 transition hover:border-white/30 hover:text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
                <a
                  href={`mailto:${lead.email}`}
                  aria-label={`Email de ${lead.full_name}`}
                  className="rounded-lg border border-white/10 p-2 text-white/50 transition hover:border-white/30 hover:text-white"
                >
                  <Mail className="h-4 w-4" />
                </a>
              </div>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                  lead.status === "nuevo"
                    ? "bg-stride-accent/15 text-stride-accent"
                    : lead.status === "convertido"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-white/10 text-white/50"
                }`}
              >
                {lead.status}
              </span>
            </div>
          ))}
        </section>
      ) : (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <UserPlus className="h-10 w-10 text-white/25" />
          <p className="font-heading text-lg font-bold text-white">Todavía no hay leads</p>
          <p className="max-w-sm text-sm text-white/50">
            Aparecerán acá apenas alguien complete el formulario de la landing.
          </p>
        </div>
      )}
    </div>
  );
}
