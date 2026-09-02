"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CalendarPlus, ChevronDown, Loader2, Mail, MessageCircle, PauseCircle, Pencil, PlayCircle, X } from "lucide-react";
import { renewMember, sendMemberInvitation, setMemberStatus, updateMember } from "@/app/admin/miembros/actions";
import type { Member } from "@/lib/types";

export function MemberRow({ member, valid, validUntilLabel }: {
  member: Member;
  valid: boolean;
  validUntilLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
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

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("edit");
    setMessage(null);
    const data = new FormData(e.currentTarget);
    data.set("id", member.id);
    const result = await updateMember(data);
    setBusy(null);
    setMessage(result.ok ? "Ficha guardada." : result.error ?? "No se pudo guardar.");
    if (result.ok) { setEditing(false); router.refresh(); }
  }

  // WhatsApp con el nombre ya escrito: abre la conversación lista para saludar.
  const wa = member.whatsapp ? member.whatsapp.replace(/\D/g, "") : null;
  const waHref = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${member.full_name.split(" ")[0]}! `)}` : null;

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

        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
            aria-label={`WhatsApp a ${member.full_name}`} title={`WhatsApp a ${member.full_name.split(" ")[0]}`}
            className="hidden shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 sm:inline-flex">
            <MessageCircle className="h-3.5 w-3.5" /> {member.full_name.split(" ")[0]}
          </a>
        )}

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
          {editing ? (
            <form onSubmit={saveEdit} className="space-y-3 rounded-xl border border-stride-accent/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Editar ficha</p>
                <button type="button" onClick={() => setEditing(false)} aria-label="Cerrar" className="rounded-md p-1 text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor={`fn-${member.id}`}>Nombre</label>
                  <input id={`fn-${member.id}`} name="full_name" defaultValue={member.full_name} required className="input py-2 text-sm" />
                </div>
                <div>
                  <label className="label" htmlFor={`em-${member.id}`}>Email</label>
                  <input id={`em-${member.id}`} name="email" type="email" defaultValue={member.email ?? ""} required className="input py-2 text-sm" />
                </div>
                <div>
                  <label className="label" htmlFor={`wa-${member.id}`}>WhatsApp</label>
                  <input id={`wa-${member.id}`} name="whatsapp" defaultValue={member.whatsapp ?? ""} className="input py-2 text-sm" placeholder="+56 9 …" />
                </div>
                <div>
                  <label className="label" htmlFor={`vu-${member.id}`}>Vigente hasta</label>
                  <input id={`vu-${member.id}`} name="valid_until" type="date" defaultValue={member.valid_until ?? ""} className="input py-2 text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor={`no-${member.id}`}>Notas</label>
                  <textarea id={`no-${member.id}`} name="notes" rows={2} defaultValue={member.notes ?? ""} className="input resize-y py-2 text-sm" />
                </div>
              </div>
              <button type="submit" disabled={busy === "edit"} className="btn-primary px-5 py-2 text-sm">
                {busy === "edit" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar ficha"}
              </button>
            </form>
          ) : (
            <div className="grid gap-3 text-sm sm:grid-cols-4">
              <Info label="Email" value={member.email ?? "Sin email"} />
              <Info label="WhatsApp" value={member.whatsapp ?? "Sin número"} />
              <Info label="Invitación" value={member.invitation_status} />
              <Info label="Último ingreso" value={member.last_login_at ? new Intl.DateTimeFormat("es-CL", { dateStyle: "short" }).format(new Date(member.last_login_at)) : "Todavía no ingresa"} />
              {member.notes && <p className="text-xs text-white/50 sm:col-span-4">{member.notes}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={Boolean(busy)} onClick={() => run("invite", sendMemberInvitation, member.invitation_status === "pendiente" ? "Invitación enviada." : "Código reenviado.")} className="btn-primary px-4 py-2 text-sm">
              {busy === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {member.invitation_status === "pendiente" ? "Enviar invitación" : "Reenviar código"}
            </button>

            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn-secondary px-4 py-2 text-sm">
                <MessageCircle className="h-4 w-4" /> WhatsApp a {member.full_name.split(" ")[0]}
              </a>
            )}

            <button type="button" disabled={Boolean(busy)} onClick={() => {
              if (confirm(`¿Renovar a ${member.full_name} por un mes?`)) void run("renew", renewMember, "Membresía renovada por un mes.");
            }} className="btn-secondary px-4 py-2 text-sm">
              {busy === "renew" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />} Renovar un mes
            </button>

            <button type="button" disabled={Boolean(busy)} onClick={() => void changeStatus(member.status === "pausada" ? "activa" : "pausada")} className="btn-secondary px-4 py-2 text-sm">
              {member.status === "pausada" ? <><PlayCircle className="h-4 w-4" /> Reactivar</> : <><PauseCircle className="h-4 w-4" /> Pausar</>}
            </button>

            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="btn-secondary px-4 py-2 text-sm">
                <Pencil className="h-4 w-4" /> Editar
              </button>
            )}
          </div>
          {message && <p className="text-sm text-white/60">{message}</p>}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-xs text-white/35">{label}</p><p className="mt-1 break-all text-white/75">{value}</p></div>;
}
