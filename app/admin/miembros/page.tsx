import { IdCard } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMembershipValid, formatDateCL } from "@/lib/membership";
import { NewMemberForm } from "@/components/admin/NewMemberForm";
import { MemberRow } from "@/components/admin/MemberRow";
import { SITE } from "@/lib/site";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MiembrosPage() {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("members")
    .select("*")
    .order("created_at", { ascending: false });

  const members = (data ?? []) as Member[];
  const active = members.filter(isMembershipValid).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Miembros</h1>
        <p className="mt-1 text-white/50">
          {members.length} en total · {active} con membresía vigente
        </p>
      </header>

      <NewMemberForm />

      {members.length > 0 ? (
        <section className="space-y-2">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              valid={isMembershipValid(member)}
              cardUrl={`${SITE.url}/tarjeta/${member.card_token}`}
              validateUrl={`${SITE.url}/validar/${member.member_code}`}
              validUntilLabel={formatDateCL(member.valid_until)}
            />
          ))}
        </section>
      ) : (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <IdCard className="h-10 w-10 text-white/25" />
          <p className="font-heading text-lg font-bold text-white">Todavía no hay miembros</p>
          <p className="max-w-sm text-sm text-white/50">
            Cuando alguien pague en Skool, dalo de alta acá y le generamos su tarjeta con QR.
          </p>
        </div>
      )}
    </div>
  );
}
