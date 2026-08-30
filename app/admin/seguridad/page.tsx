import { ShieldCheck } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { TotpManager } from "@/components/admin/TotpManager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Seguridad" };

export default async function SecurityPage() {
  const member = await requireTeamMember();

  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
          <ShieldCheck className="h-3.5 w-3.5" /> Seguridad
        </p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">Tu acceso</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          El ERP guarda datos de miembros, finanzas y actas. Con la contraseña sola,
          quien la consiga entra. El segundo factor lo impide: además de la clave
          pide un código que solo existe en tu teléfono.
        </p>
      </header>

      <TotpManager accountEmail={member.email} />
    </div>
  );
}
