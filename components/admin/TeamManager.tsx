"use client";

import Image from "next/image";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { Camera, Check, Loader2, Mail, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { createTeamMember, deleteTeamMember, sendTeamInvitation, updateTeamMember, uploadTeamPhoto } from "@/app/admin/equipo/actions";
import { ROLE_LABELS } from "@/lib/roles";
import type { TeamColumn } from "@/lib/app-settings";
import type { TeamMember } from "@/lib/types";

const ROLE_STYLES: Record<string, string> = {
  socio: "bg-stride-accent/15 text-stride-accent",
  lider_comunidad: "bg-amber-500/15 text-amber-400",
  monitor: "bg-white/10 text-white/60",
};

export function TeamManager({
  team,
  photoUrls,
  currentMemberId,
  columns = [],
}: {
  team: TeamMember[];
  photoUrls: Record<string, string>;
  currentMemberId: string;
  /** Columnas extra definidas en Configuración. */
  columns?: TeamColumn[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      {creating ? (
        <PersonForm title="Nueva persona" action={createTeamMember} columns={columns} onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Agregar persona
        </button>
      )}

      <section className="space-y-2">
        {team.map((person) =>
          editing === person.id ? (
            <PersonForm
              key={person.id}
              title={`Editar a ${person.nickname ?? person.full_name}`}
              person={person}
              action={updateTeamMember}
              columns={columns}
              onDone={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <PersonRow
              key={person.id}
              person={person}
              photoUrl={photoUrls[person.id] ?? null}
              isSelf={person.id === currentMemberId}
              columns={columns}
              onEdit={() => setEditing(person.id)}
            />
          )
        )}
      </section>
    </div>
  );
}

function PersonRow({
  person,
  photoUrl,
  isSelf,
  columns = [],
  onEdit,
}: {
  person: TeamMember;
  photoUrl: string | null;
  isSelf: boolean;
  columns?: TeamColumn[];
  onEdit: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function uploadPhoto(file: File) {
    const form = new FormData();
    form.set("id", person.id);
    form.set("photo", file);
    setError(null);
    startTransition(async () => {
      const result = await uploadTeamPhoto(form);
      if (!result.ok) setError(result.error ?? "No se pudo subir.");
    });
  }

  function remove() {
    if (!window.confirm(`¿Eliminar a ${person.full_name}? Solo se puede si nunca tuvo cuenta.`)) return;
    const form = new FormData();
    form.set("id", person.id);
    setError(null);
    startTransition(async () => {
      const result = await deleteTeamMember(form);
      if (!result.ok) setError(result.error ?? "No se pudo eliminar.");
    });
  }

  function sendAccess() {
    if (!window.confirm(`¿Enviar acceso al ERP a ${person.email}?`)) return;
    const form = new FormData();
    form.set("id", person.id);
    setError(null);
    startTransition(async () => {
      const result = await sendTeamInvitation(form);
      if (!result.ok) setError(result.error ?? "No se pudo enviar el acceso.");
    });
  }

  return (
    <div className={`card py-4 ${person.status === "inactivo" ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Cambiar foto"
          className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5"
        >
          {photoUrl ? (
            <Image src={photoUrl} alt={person.full_name} fill unoptimized className="object-cover" />
          ) : (
            <UserRound className="absolute inset-0 m-auto h-5 w-5 text-white/35" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
            {pending ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Camera className="h-4 w-4 text-white" />}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
        />

        <div className="min-w-[180px] flex-1">
          <p className="font-medium text-white">
            {person.full_name}
            {person.nickname && person.nickname !== person.full_name && (
              <span className="ml-1.5 text-sm text-white/40">({person.nickname})</span>
            )}
            {isSelf && <span className="ml-1.5 text-xs text-stride-cyan">tú</span>}
          </p>
          <p className="mt-0.5 text-xs text-white/40">
            {person.email.startsWith("PENDIENTE") ? (
              <span className="text-amber-400/70">Falta su correo real</span>
            ) : (
              person.email
            )}
            {person.area && ` · ${person.area}`}
          </p>
          {columns.some((c) => person.extra?.[c.key]) && (
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/45">
              {columns.filter((c) => person.extra?.[c.key]).map((c) => (
                <span key={c.key}><span className="text-white/30">{c.label}:</span> {person.extra?.[c.key]}</span>
              ))}
            </p>
          )}
        </div>

        {!person.auth_user_id && (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-400">Sin acceso</span>
        )}
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_STYLES[person.role]}`}>
          {ROLE_LABELS[person.role]}
        </span>
        {person.status === "inactivo" && (
          <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/40">Inactivo</span>
        )}

        <div className="flex shrink-0 gap-1.5">
          {person.status === "activo" && (
            <button
              type="button"
              onClick={sendAccess}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stride-accent/35 px-3 py-2 text-xs font-semibold text-stride-accent hover:border-stride-accent hover:bg-stride-accent/10 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              {person.auth_user_id ? "Reenviar acceso" : "Dar acceso"}
            </button>
          )}
          <button type="button" onClick={onEdit} className="rounded-lg border border-white/10 p-2 text-white/50 hover:text-white" aria-label="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {!person.auth_user_id && !isSelf && (
            <button type="button" onClick={remove} disabled={pending} className="rounded-lg border border-white/10 p-2 text-white/30 hover:border-red-400/40 hover:text-red-300" aria-label="Eliminar">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
    </div>
  );
}

function PersonForm({
  title,
  person,
  action,
  columns = [],
  onDone,
  onCancel,
}: {
  title: string;
  person?: TeamMember;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  columns?: TeamColumn[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (person) form.set("id", person.id);
    setError(null);
    startTransition(async () => {
      const result = await action(form);
      if (result.ok) onDone();
      else setError(result.error ?? "No se pudo guardar.");
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="font-heading text-lg font-bold text-white">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="full_name" className="label">Nombre completo</label>
          <input id="full_name" name="full_name" required defaultValue={person?.full_name} className="input" />
        </div>
        <div>
          <label htmlFor="nickname" className="label">Apodo</label>
          <input id="nickname" name="nickname" defaultValue={person?.nickname ?? ""} className="input" placeholder="Como le dicen en el equipo" />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required defaultValue={person?.email} className="input" />
          <p className="mt-1 text-xs text-white/35">Es la llave del login: tiene que ser el real.</p>
        </div>
        <div>
          <label htmlFor="area" className="label">Área</label>
          <input id="area" name="area" defaultValue={person?.area ?? ""} className="input" placeholder="Planificación, rutas…" />
        </div>
        <div>
          <label htmlFor="role" className="label">Rol</label>
          <select id="role" name="role" defaultValue={person?.role ?? "monitor"} className="input">
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value} className="bg-stride-card">{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="label">Estado</label>
          <select id="status" name="status" defaultValue={person?.status ?? "activo"} className="input">
            <option value="activo" className="bg-stride-card">Activo</option>
            <option value="inactivo" className="bg-stride-card">Inactivo</option>
          </select>
        </div>
      </div>

      {columns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {columns.map((c) => (
            <div key={c.key}>
              <label htmlFor={`extra-${c.key}`} className="label">{c.label}</label>
              <input id={`extra-${c.key}`} name={`extra.${c.key}`} defaultValue={person?.extra?.[c.key] ?? ""} className="input" />
            </div>
          ))}
        </div>
      )}
      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Guardar</>}
        </button>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-white/60 hover:text-white">
          <X className="h-4 w-4" /> Cancelar
        </button>
      </div>
    </form>
  );
}
