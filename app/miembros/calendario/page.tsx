import { getCurrentMember, getCommunityStaff } from "@/lib/member-auth";
import { getMemberEvents } from "@/lib/community";
import { todayInChile } from "@/lib/membership";
import { CalendarClient } from "@/components/community/CalendarClient";
import { EventAdminPanel } from "@/components/community/EventAdminPanel";

export const dynamic = "force-dynamic";

/** Calendario: Social Runs presenciales + sesiones online. */
export default async function CalendarioPage() {
  const [member, staff] = await Promise.all([getCurrentMember(), getCommunityStaff()]);
  const events = await getMemberEvents(member?.id ?? null);
  return (
    <div className="mx-auto max-w-4xl">
      {staff && <EventAdminPanel events={events} />}
      <CalendarClient events={events} today={todayInChile()} />
    </div>
  );
}
