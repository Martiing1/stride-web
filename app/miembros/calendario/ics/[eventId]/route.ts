import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/member-auth";

export const dynamic = "force-dynamic";

/**
 * "Agregar a mi calendario": entrega el evento como archivo .ics.
 * En el celular, abrirlo ofrece Google/Apple Calendar directamente.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { eventId } = await params;
  const service = createServiceClient();
  const { data: event } = await service
    .from("events")
    .select("id, title, event_date, event_time, meeting_point, meet_url")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const time = (event.event_time ?? "09:00:00").slice(0, 8).replace(/:/g, "");
  const date = event.event_date.replace(/-/g, "");
  const start = `${date}T${time}`;
  // Duración por defecto: 90 minutos.
  const [hh, mm] = [(event.event_time ?? "09:00").slice(0, 2), (event.event_time ?? "09:00").slice(3, 5)];
  const endMinutes = Number(hh) * 60 + Number(mm) + 90;
  const end = `${date}T${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}${String(endMinutes % 60).padStart(2, "0")}00`;

  const escape = (value: string) => value.replace(/([,;])/g, "\\$1");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//STRIDE//Comunidad//ES",
    "BEGIN:VEVENT",
    `UID:${event.id}@stridechile.cl`,
    `DTSTART;TZID=America/Santiago:${start}`,
    `DTEND;TZID=America/Santiago:${end}`,
    `SUMMARY:${escape(event.title)} · STRIDE`,
    event.meeting_point ? `LOCATION:${escape(event.meeting_point)}` : null,
    event.meet_url ? `DESCRIPTION:Unirse: ${event.meet_url}` : "DESCRIPTION:Nos vemos ahí 🏃",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="stride-${date}.ics"`,
    },
  });
}
