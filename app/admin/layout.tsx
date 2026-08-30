import { requireTeamMember, isCurrentUserOwner } from "@/lib/auth";
import { Sidebar } from "@/components/admin/Sidebar";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { headers } from "next/headers";

export const metadata = {
  title: "ERP STRIDE",
  robots: { index: false, follow: false },
};

/**
 * Layout del ERP. El middleware ya garantizó que hay sesión; acá se resuelve la
 * persona del equipo y su rol, que determina qué se ve en la navegación.
 *
 * /admin/login y /admin/activar también heredan este layout padre, por lo que
 * se excluyen abajo antes de exigir sesión.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-stride-pathname");

  // Los layouts de App Router siempre envuelven a sus rutas hijas. Por eso el
  // layout propio de /admin/login no reemplaza este layout padre: hay que
  // excluir el login explícitamente antes de exigir una sesión.
  if (pathname?.startsWith("/admin/login") || pathname?.startsWith("/admin/activar")) {
    return <>{children}</>;
  }

  const member = await requireTeamMember();
  const isOwner = await isCurrentUserOwner();

  return (
    <div className="flex min-h-dvh flex-col bg-stride-bg lg:flex-row">
      <Sidebar
        role={member.role}
        name={member.nickname ?? member.full_name}
        isOwner={isOwner}
        onSignOut={<SignOutButton />}
      />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
      </div>
    </div>
  );
}
