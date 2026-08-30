import { ShieldCheck } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { TotpManager } from "@/components/admin/TotpManager";
import { MyPhotoUploader } from "@/components/admin/MyPhotoUploader";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Seguridad" };

export default async function SecurityPage() {
  const member = await requireTeamMember();

  let photoUrl: string | null = null;
  if (member.photo_path) {
    const { data: signed } = await createServiceClient()
      .storage.from("team-photos")
      .createSignedUrl(member.photo_path, 600);
    photoUrl = signed?.signedUrl ?? null;
  }

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

      <MyPhotoUploader photoUrl={photoUrl} name={member.nickname ?? member.full_name} />

      <TotpManager accountEmail={member.email} />
    </div>
  );
}
