"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="flex items-center gap-2 text-xs text-white/45 transition hover:text-white"
    >
      <LogOut className="h-3.5 w-3.5" />
      Cerrar sesión
    </button>
  );
}
