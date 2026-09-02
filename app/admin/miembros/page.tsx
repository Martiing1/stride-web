import { IdCard, ShieldCheck } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isMembershipValid, formatDateCL } from "@/lib/membership";
import { safeQuery } from "@/lib/safe-query";
import { NewMemberForm } from "@/components/admin/NewMemberForm";
import { MemberRow } from "@/components/admin/MemberRow";
import { CommunityQueues, type QueueItem } from "@/components/admin/CommunityQueues";
import { EventlyImport } from "@/components/admin/CommunityTools";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Miembros (socios). Desde el 02-09 concentra también lo que era el módulo
 * Comunidad: la cola de verificaciones (evidencias de retos, medallas físicas,
 * pausas) y el import de asistencia desde el .xlsx de Evently, que es lo que
 * acredita la asistencia a un Social Run para los retos.
 */
export default async function MiembrosPage() {
  await requireTeamMember(["socio"]);
  const supabase = await createClient();
  const service = createServiceClient();

  const [{ data }, evidencias, fisicas, pausas, events] = await Promise.all([
    supabase.from("members").select("*").order("created_at", { ascending: false }),
    safeQuery(
      () =>
        service
          .from("challenge_progress")
          .select("id, evidence_path, updated_at, members:member_id(full_name), challenges:challenge_id(title)")
          .eq("status", "en_verificacion")
          .order("updated_at")
          .returns<Array<{ id: string; evidence_path: string | null; updated_at: string; members: { full_name: string } | null; challenges: { title: string } | null }>>(),
      [] as Array<{ id: string; evidence_path: string | null; updated_at: string; members: { full_name: string } | null; challenges: { title: string } | null }>
    ),
    safeQuery(
      () =>
        service
          .from("member_medals")
          .select("id, title_override, photo_path, awarded_at, members:member_id(full_name)")
          .eq("status", "en_revision")
          .order("awarded_at")
          .returns<Array<{ id: string; title_override: string | null; photo_path: string | null; awarded_at: string; members: { full_name: string } | null }>>(),
      [] as Array<{ id: string; title_override: string | null; photo_path: string | null; awarded_at: string; members: { full_name: string } | null }>
    ),
    safeQuery(
      () =>
        service
          .from("pause_requests")
          .select("id, note, created_at, members:member_id(full_name)")
          .eq("status", "pendiente")
          .order("created_at")
          .returns<Array<{ id: string; note: string; created_at: string; members: { full_name: string } | null }>>(),
      [] as Array<{ id: string; note: string; created_at: string; members: { full_name: string } | null }>
    ),
    safeQuery(
      () =>
        service
          .from("events")
          .select("id, title, event_date")
          .in("status", ["confirmado", "completado"])
          .order("event_date", { ascending: false })
          .limit(20),
      [] as Array<{ id: string; title: string; event_date: string }>
    ),
  ]);

  const members = (data ?? []) as Member[];
  const active = members.filter(isMembershipValid).length;

  const sign = async (path: string | null, bucket: string) => {
    if (!path) return null;
    const { data: signed } = await service.storage.from(bucket).createSignedUrl(path, 600);
    return signed?.signedUrl ?? null;
  };

  const queue: QueueItem[] = [
    ...(await Promise.all(evidencias.map(async (row) => ({
      id: row.id, kind: "reto" as const, memberName: row.members?.full_name ?? "Miembro",
      title: row.challenges?.title ?? "Reto", detail: null, mediaUrl: await sign(row.evidence_path, "evidence"), createdAt: row.updated_at,
    })))),
    ...(await Promise.all(fisicas.map(async (row) => ({
      id: row.id, kind: "medalla" as const, memberName: row.members?.full_name ?? "Miembro",
      title: row.title_override ?? "Medalla física", detail: null, mediaUrl: await sign(row.photo_path, "medal-photos"), createdAt: row.awarded_at,
    })))),
    ...pausas.map((row) => ({
      id: row.id, kind: "pausa" as const, memberName: row.members?.full_name ?? "Miembro",
      title: "Solicitud de pausa", detail: row.note, mediaUrl: null, createdAt: row.created_at,
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Miembros</h1>
        <p className="mt-1 text-white/50">
          {members.length} en total · {active} con membresía vigente · {queue.length} por verificar
        </p>
      </header>

      {/* Vista admin: verificaciones de la comunidad + asistencia Evently */}
      <section className="card space-y-5">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white">
            <ShieldCheck className="h-5 w-5 text-stride-cyan" /> Verificaciones
          </h2>
          <p className="mt-1 text-xs text-white/40">
            Evidencias de retos, medallas físicas y pausas que esperan un visto bueno. Aprobar una evidencia paga los puntos del reto.
          </p>
        </div>
        <CommunityQueues items={queue} />
        <div className="border-t border-white/5 pt-5">
          <h3 className="font-heading font-bold text-white">Asistencia a Social Runs (Evently)</h3>
          <p className="mt-1 mb-3 text-xs text-white/40">
            La asistencia se acredita con el .xlsx que exporta Evently de cada Social Run: alimenta los retos de asistencia y las métricas del evento.
          </p>
          <EventlyImport events={events} />
        </div>
      </section>

      <NewMemberForm />

      {members.length > 0 ? (
        <section className="space-y-2">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              valid={isMembershipValid(member)}
              validUntilLabel={formatDateCL(member.valid_until)}
            />
          ))}
        </section>
      ) : (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <IdCard className="h-10 w-10 text-white/25" />
          <p className="font-heading text-lg font-bold text-white">Todavía no hay miembros</p>
          <p className="max-w-sm text-sm text-white/50">
            Crea la primera ficha y después envía su invitación cuando esté todo revisado.
          </p>
        </div>
      )}
    </div>
  );
}
