import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getCurrentMember } from "@/lib/member-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { isMembershipValid, formatDateCL } from "@/lib/membership";
import { whatsappLink } from "@/lib/site";
import { ThemeToggle } from "@/components/community/ThemeToggle";
import { PauseCard } from "@/components/community/PauseCard";
import { DisplayNameForm } from "@/components/community/DisplayNameForm";
import { memberDisplayName } from "@/lib/community-shared";

export const dynamic = "force-dynamic";

/** Configuración del miembro: tema, membresía (pausa) y suscripción. */
export default async function ConfigPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/miembros");
  const valid = isMembershipValid(member);
  const service = createServiceClient();

  const pendingPause = await safeQuery(
    () =>
      service
        .from("pause_requests")
        .select("id")
        .eq("member_id", member.id)
        .eq("status", "pendiente")
        .maybeSingle(),
    null as { id: string } | null
  );

  const renovarUrl = whatsappLink(
    `Hola! Soy ${member.full_name} (${member.member_code}) y quiero renovar mi membresía STRIDE ONE.`
  );
  const cancelarUrl = whatsappLink(
    `Hola! Soy ${member.full_name} (${member.member_code}) y quiero conversar sobre cancelar mi membresía STRIDE ONE.`
  );

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/miembros/perfil" className="inline-flex items-center gap-2 text-sm text-[var(--smut)] hover:text-[var(--stext)]">
        <ArrowLeft className="h-4 w-4" /> Perfil
      </Link>

      <h1 className="font-heading text-xl font-bold">Configuración</h1>

      <section className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-5">
        <h2 className="font-heading text-base font-bold">Tu nombre</h2>
        <p className="mt-1 text-sm text-[var(--smut)]">Cómo quieres aparecer en la comunidad.</p>
        <DisplayNameForm initial={memberDisplayName(member)} realName={member.full_name} />
      </section>

      <section className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-5">
        <h2 className="font-heading text-base font-bold">Apariencia</h2>
        <p className="mt-1 text-sm text-[var(--smut)]">Elige cómo se ve tu espacio STRIDE ONE.</p>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </section>

      <PauseCard hasPending={Boolean(pendingPause)} />

      <section className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-5">
        <h2 className="font-heading text-base font-bold">Suscripción</h2>
        <p className="mt-1 text-sm text-[var(--smut)]">
          STRIDE ONE · {valid ? "activa" : member.status === "pausada" ? "pausada" : "no vigente"} · vigente
          hasta {formatDateCL(member.valid_until)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <a href={renovarUrl} target="_blank" rel="noopener noreferrer" className="btn-primary px-5 py-2.5 text-sm">
            Renovar
          </a>
          <a
            href={cancelarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-[var(--sline2)] px-5 py-2.5 font-heading text-sm font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)]"
          >
            Cancelar
          </a>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--sdim)]">
          <MessageCircle className="h-3.5 w-3.5" /> Por ahora ambas opciones te conectan con el equipo por
          WhatsApp.
        </p>
      </section>
    </div>
  );
}
