import { getCurrentMember } from "@/lib/member-auth";
import { getMemberEvents } from "@/lib/community";
import { todayInChile } from "@/lib/membership";
import { CalendarClient } from "@/components/community/CalendarClient";

export const dynamic = "force-dynamic";

/** Calendario: Social Runs presenciales + sesiones online. */
export default async function CalendarioPage() {
  const member = await getCurrentMember();
  const events = await getMemberEvents(member?.id ?? null);
  return (
    <div className="mx-auto max-w-4xl">
      <CalendarClient events={events} today={todayInChile()} />
    </div>
  );
}
