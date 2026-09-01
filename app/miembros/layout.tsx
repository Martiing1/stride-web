import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { getCurrentMember, getCommunityStaff, getSignedMemberPhoto } from "@/lib/member-auth";
import { getNotifications } from "@/lib/community";
import { MemberTabs } from "@/components/community/MemberTabs";
import { BellButton } from "@/components/community/BellButton";
import { AdminBar } from "@/components/community/AdminBar";

export const metadata: Metadata = {
  title: "STRIDE ONE · Comunidad",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Shell del área de miembros. Tokens de tema en .mshell (globals.css): el
 * script inline aplica el tema guardado ANTES del primer paint para que el
 * modo claro no parpadee.
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-stride-pathname") ?? "";
  if (pathname.startsWith("/miembros/ingresar")) return <>{children}</>;

  const [member, staff] = await Promise.all([getCurrentMember(), getCommunityStaff()]);
  if (!member && !staff) redirect("/miembros/ingresar");

  const [photoUrl, notifications] = await Promise.all([
    member ? getSignedMemberPhoto(member) : Promise.resolve(null),
    member ? getNotifications(member.id) : Promise.resolve({ items: [], unread: 0 }),
  ]);

  const displayName = member?.full_name ?? staff!.nickname ?? staff!.full_name;
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className="mshell min-h-dvh" id="mshell">
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('stride_mtheme')==='light'){document.getElementById('mshell').setAttribute('data-mtheme','light')}}catch(e){}`,
        }}
      />
      <header className="sticky top-0 z-40 border-b border-[var(--sline)] bg-[var(--sbg)]/90 px-4 pt-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
          <Link href="/miembros" className="wordmark font-heading text-lg font-extrabold tracking-tight">
            STRIDE ONE
          </Link>

          {/* Búsqueda (web): filtra el blog por texto. */}
          <form
            action="/miembros"
            className="ml-3 hidden min-w-0 max-w-md flex-1 items-center gap-2 rounded-full border border-[var(--sline)] bg-[var(--scard2)] px-4 py-2 md:flex"
          >
            <Search className="h-4 w-4 flex-none text-[var(--sdim)]" />
            <input
              name="q"
              placeholder="Buscar publicaciones…"
              className="w-full bg-transparent text-sm text-[var(--stext)] outline-none placeholder:text-[var(--sdim)]"
            />
          </form>

          <div className="ml-auto flex items-center gap-2.5">
            <BellButton unread={notifications.unread} items={notifications.items} />
            <Link
              href="/miembros/perfil"
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[var(--sline2)] bg-gradient-to-br from-stride-cyan/25 to-stride-accent/40 font-heading text-xs font-bold text-white"
            >
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-5xl">
          <MemberTabs />
        </div>
      </header>

      {staff && <AdminBar name={staff.nickname ?? staff.full_name.split(" ")[0]} />}

      <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-24 sm:px-6">{children}</main>
    </div>
  );
}
