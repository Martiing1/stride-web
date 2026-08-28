import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LeadsKanban } from "@/components/admin/LeadsKanban";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const member = await requireTeamMember(["socio", "lider_comunidad"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  const leads = (data ?? []) as Lead[];
  const nuevos = leads.filter((l) => l.status === "nuevo").length;
  const convertidos = leads.filter((l) => l.status === "convertido").length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Leads</h1>
        <p className="mt-1 text-white/50">
          {leads.length} en total · {nuevos} sin contactar · {convertidos} convertidos
        </p>
      </header>

      <LeadsKanban leads={leads} canDelete={member.role === "socio"} />
    </div>
  );
}
