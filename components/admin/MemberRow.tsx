"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CalendarPlus, ChevronDown, Loader2, Mail, PauseCircle, PlayCircle } from "lucide-react";
import { renewMember, sendMemberInvitation, setMemberStatus } from "@/app/admin/miembros/actions";
import type { Member } from "@/lib/types";

export function MemberRow({ member, valid, validUntilLabel }: {
  member: Member;
  valid: boolean;
  validUntilLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    key: string,
    action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>,
    success: string
  ) {
    setBusy(key);
    setMessage(null);
    const data = new FormData();
    data.set("id", member.id);
    const result = await action(data);
    setBusy(null);
    setMessage(result.ok ? success : result.error ?? "No se pudo completar.");
    if (result.ok) router.refresh();
  }

  async function changeStatus(status: Member["status"]) {
    setBusy("status");
    setMessage(null);
    const data = new FormData();
    data.set("id", member.id);
    data.set("status", status);
    const result = await setMemberStatus(data);
    setBusy(null);
    setMessage(result.ok ? "Estado actualizado." : result.error ?? "No se pudo actualizar.");
    if (result.ok) router.refresh();
  }

  return (
    <div className="card p-0">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-4 p-4 text-left">
        {member.photo_url ? (
          <Image src={member.photo_url} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 font-heading font-bold text-white/50">
            {member.full_name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{member.full_name}</p>
          <p className="truncate text-xs text-white/40"><span className="font-mono">{member.member_code}</span> · vence {validUntilLabel}</p>
        </div>

        <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${
          member.invitation_status === "activada" ? "bg-cyan-500/15 text-cyan-300" :
          member.invitation_status === "error" ? "bg-red-500/15 text-red-300" : "bg-white/5 text-white/45"
        }`}>{member.invitation_status}</span>

        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${valid ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
          {valid ? "Vigente" : member.status}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/30 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/5 p-5">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Email" value={member.email ?? "Sin email"} />
            <Info label="Invitación" value={member.invitation_status} />
            <Info label="Último ingreso" value={member.last_login_at ? new Intl.DateTimeFormat("es-CL", { dateStyle: "short" }).format(new Date(member.last_login_at)) : "Todavía no ingresa"} />
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={Boolean(busy)} onClick={() => run("invite", sendMemberInvitation, member.invitation_status === "pendiente" ? "Invitación enviada." : "Código reenviado.")} className="btn-primary px-4 py-2 text-sm">
              {busy === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {member.invitation_status === "pendiente" ? "Enviar invitación" : "Reenviar código"}
            </button>

            <button type="button" disabled={Boolean(busy)} onClick={() => {
              if (confirm(`¿Renovar a ${member.full_name} por un mes?`)) void run("renew", renewMember, "Membresía renovada por un mes.");
            }} className="btn-secondary px-4 py-2 text-sm">
              {busy === "renew" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />} Renovar un mes
            </button>

            <button type="button" disabled={Boolean(busy)} onClick={() => void changeStatus(member.status === "pausada" ? "activa" : "pausada")} className="btn-secondary px-4 py-2 text-sm">
              {member.status === "pausada" ? <><PlayCircle className="h-4 w-4" /> Reactivar</> : <><PauseCircle className="h-4 w-4" /> Pausar</>}
            </button>
          </div>
          {message && <p className="text-sm text-white/60">{message}</p>}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-xs text-white/35">{label}</p><p className="mt-1 break-all capitalize text-white/75">{value}</p></div>;
}
