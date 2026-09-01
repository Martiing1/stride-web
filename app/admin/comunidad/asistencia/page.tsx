import { requireTeamMember } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { EventlyImport } from "@/components/admin/CommunityTools";

export const dynamic = "force-dynamic";
export const metadata = { title: "Asistencia" };

export default async function AsistenciaPage() {
  await requireTeamMember(["socio", "lider_comunidad"]);
  const service = createServiceClient();

  const [events, lastImports] = await Promise.all([
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
    safeQuery(
      () =>
        service
          .from("event_attendance")
          .select("id, attendee_email, member_id, created_at, events:event_id(title)")
          .order("created_at", { ascending: false })
          .limit(12)
          .returns<Array<{ id: string; attendee_email: string | null; member_id: string | null; created_at: string; events: { title: string } | null }>>(),
      [] as Array<{ id: string; attendee_email: string | null; member_id: string | null; created_at: string; events: { title: string } | null }>
    ),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Asistencia</h1>
        <p className="mt-1 text-white/50">
          Sube el CSV de Evently después de cada Social Run: acredita asistencia, paga puntos y alimenta las
          rachas y los retos.
        </p>
      </header>

      <EventlyImport events={events} />

      {lastImports.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-lg font-bold text-white">Últimos registros</h2>
          <div className="space-y-1.5">
            {lastImports.map((row) => (
              <div key={row.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm">
                <span>{row.member_id ? "✅" : "❓"}</span>
                <span className="min-w-0 flex-1 truncate text-white/75">{row.attendee_email ?? "—"}</span>
                <span className="truncate text-xs text-white/40">{row.events?.title}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/35">❓ = sin match con un miembro (revísalo en Miembros y corrige el email).</p>
        </section>
      )}
    </div>
  );
}
