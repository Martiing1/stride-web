import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/member-auth";
import { isMembershipValid } from "@/lib/membership";
import { rotatingQrUrl } from "@/lib/rotating-qr";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isMembershipValid(member)) return NextResponse.json({ error: "Membresía no vigente" }, { status: 403 });

  return NextResponse.json(rotatingQrUrl(member.member_code, SITE.url), {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
