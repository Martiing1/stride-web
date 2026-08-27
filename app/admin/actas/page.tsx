import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ActasPage() {
  await requireTeamMember();
  const supabase = await createClient();

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, code, title, meeting_date, attendees")
    .order("meeting_date", { ascending: false });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-white">Actas</h1>
          <p className="mt-1 text-white/50">
            Sube el acta y el sistema crea las tareas, decisiones y seguimientos.
          </p>
        </div>
        <Link href="/admin/actas/nueva" className="btn-primary">
          <Plus className="h-4 w-4" /> Subir acta
        </Link>
      </header>

      {meetings && meetings.length > 0 ? (
        <ul className="space-y-2">
          {meetings.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/actas/${m.id}`}
                className="card flex items-center justify-between gap-4 transition hover:border-white/20"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{m.title}</p>
                  <p className="mt-0.5 text-xs text-white/40">
                    {m.meeting_date.split("-").reverse().join("/")}
                    {m.attendees.length > 0 && ` · ${m.attendees.join(", ")}`}
                  </p>
                </div>
                {m.code && (
                  <span className="shrink-0 font-mono text-[11px] text-white/30">{m.code}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card flex flex-col items-center gap-4 py-14 text-center">
          <FileText className="h-10 w-10 text-white/25" />
          <div>
            <p className="font-heading text-lg font-bold text-white">Todavía no hay actas</p>
            <p className="mt-1 text-sm text-white/50">
              Sube la primera y sus tareas quedan repartidas al equipo al instante.
            </p>
          </div>
          <Link href="/admin/actas/nueva" className="btn-primary">
            <Plus className="h-4 w-4" /> Subir acta
          </Link>
        </div>
      )}
    </div>
  );
}
