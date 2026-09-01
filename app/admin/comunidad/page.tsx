import Link from "next/link";
import { requireTeamMember } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { CommunityQueues, type QueueItem } from "@/components/admin/CommunityQueues";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comunidad" };

/**
 * Hub de la comunidad en el ERP: cola de verificación (evidencias de retos,
 * medallas físicas y pausas) + import de asistencia; retos y puntos viven en /miembros.
 */
export default async function ComunidadPage() {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const service = createServiceClient();

  const [evidencias, fisicas, pausas, stats] = await Promise.all([
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
    Promise.all([
      safeQuery(() => service.from("community_posts").select("id", { count: "exact", head: true }), null).then(() => null),
    ]).then(async () => {
      const [posts, activeChallenges] = await Promise.all([
        service.from("community_posts").select("id", { count: "exact", head: true }),
        service.from("challenges").select("id", { count: "exact", head: true }).eq("active", true),
      ]);
      return {
        posts: posts.count ?? 0,
        challenges: activeChallenges.count ?? 0,
      };
    }).catch(() => ({ posts: 0, challenges: 0 })),
  ]);

  const signEvidence = async (path: string | null, bucket: string) => {
    if (!path) return null;
    const { data } = await service.storage.from(bucket).createSignedUrl(path, 600);
    return data?.signedUrl ?? null;
  };

  const items: QueueItem[] = [
    ...(await Promise.all(
      evidencias.map(async (row) => ({
        id: row.id,
        kind: "reto" as const,
        memberName: row.members?.full_name ?? "Miembro",
        title: row.challenges?.title ?? "Reto",
        detail: null,
        mediaUrl: await signEvidence(row.evidence_path, "evidence"),
        createdAt: row.updated_at,
      }))
    )),
    ...(await Promise.all(
      fisicas.map(async (row) => ({
        id: row.id,
        kind: "medalla" as const,
        memberName: row.members?.full_name ?? "Miembro",
        title: row.title_override ?? "Medalla física",
        detail: null,
        mediaUrl: await signEvidence(row.photo_path, "medal-photos"),
        createdAt: row.awarded_at,
      }))
    )),
    ...pausas.map((row) => ({
      id: row.id,
      kind: "pausa" as const,
      memberName: row.members?.full_name ?? "Miembro",
      title: "Solicitud de pausa",
      detail: row.note,
      mediaUrl: null,
      createdAt: row.created_at,
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-white">Comunidad</h1>
          <p className="mt-1 text-white/50">
            {stats.posts} publicaciones · {stats.challenges} retos activos · {items.length} por verificar
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link href="/admin/comunidad/asistencia" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5">
            📥 Asistencia (Evently)
          </Link>
          {/* Retos y puntos se gestionan en el lugar, dentro del área de miembros. */}
          <Link href="https://stridechile.cl/miembros/retos" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5">
            🎯 Retos (en Miembros) ↗
          </Link>
          <Link href="https://stridechile.cl/miembros/ranking" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5">
            ⚙️ Puntos (en Miembros) ↗
          </Link>
        </nav>
      </header>

      <section>
        <h2 className="mb-3 font-heading text-lg font-bold text-white">Por verificar</h2>
        <CommunityQueues items={items} />
      </section>

      <p className="text-xs leading-relaxed text-white/35">
        Aprobar una evidencia paga los puntos del reto (y su medalla, si trae). Aprobar una pausa protege las
        rachas del miembro; el estado de su membresía se maneja aparte en Miembros. Si esta página aparece
        vacía y esperabas datos, revisa que la migración 012 esté ejecutada.
      </p>
    </div>
  );
}
