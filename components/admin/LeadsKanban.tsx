"use client";

import { useState, useTransition, type FormEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Loader2, MessageCircle, Mail, Trash2, StickyNote, GripVertical, Tag,
} from "lucide-react";
import { createLead, moveLead, updateLeadNotes, deleteLead, setLeadTemperature, setLeadTags } from "@/app/admin/leads/actions";
import { MOTIVATION_OPTIONS, MOTIVATION_LABELS } from "@/lib/lead-options";
import type { Lead } from "@/lib/types";

type Status = Lead["status"];

// El nombre de cada columna se configura en /admin/configuracion.
const COLUMN_DEFS: { value: Status; tone: string }[] = [
  { value: "nuevo", tone: "border-stride-cyan/40" },
  { value: "contactado", tone: "border-stride-indigo/40" },
  // Agendado = invitado a la reunión de fin de mes.
  { value: "agendado", tone: "border-amber-400/40" },
  { value: "convertido", tone: "border-emerald-500/40" },
  { value: "descartado", tone: "border-white/10" },
];

const TEMPERATURES: Array<{ value: NonNullable<Lead["temperature"]>; label: string; active: string }> = [
  { value: "frio", label: "Frío", active: "bg-sky-500/20 text-sky-300 border-sky-400/40" },
  { value: "tibio", label: "Tibio", active: "bg-amber-500/20 text-amber-300 border-amber-400/40" },
  { value: "caliente", label: "Caliente", active: "bg-red-500/20 text-red-300 border-red-400/40" },
];

export function LeadsKanban({
  leads,
  canDelete,
  labels,
}: {
  leads: Lead[];
  canDelete: boolean;
  labels: Record<string, string>;
}) {
  const COLUMNS = COLUMN_DEFS.map((c) => ({ ...c, label: labels[c.value] ?? c.value }));
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<Status | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  // La nota y las etiquetas solo se despliegan al abrir la tarjeta (02-09).
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");

  function saveTags(id: string, tags: string[]) {
    const form = new FormData();
    form.set("id", id);
    form.set("tags", JSON.stringify(tags));
    startTransition(async () => {
      const res = await setLeadTags(form);
      if (!res.ok) setError(res.error ?? "No se pudieron guardar las etiquetas.");
      router.refresh();
    });
  }

  function move(id: string, status: Status) {
    const form = new FormData();
    form.set("id", id);
    form.set("status", status);
    startTransition(async () => {
      const res = await moveLead(form);
      if (!res.ok) setError(res.error ?? "No se pudo mover.");
      router.refresh();
    });
  }

  function handleDrop(event: DragEvent, status: Status) {
    event.preventDefault();
    setOverColumn(null);
    const id = event.dataTransfer.getData("text/plain") || dragging;
    setDragging(null);
    if (id) move(id, status);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = event.currentTarget;
    const res = await createLead(new FormData(form));
    setSaving(false);

    if (!res.ok) {
      setError(res.error ?? "No se pudo crear.");
      return;
    }
    form.reset();
    setShowForm(false);
    router.refresh();
  }

  function setTemperature(id: string, current: Lead["temperature"], value: NonNullable<Lead["temperature"]>) {
    const form = new FormData();
    form.set("id", id);
    // Tocar la etiqueta activa la apaga.
    form.set("temperature", current === value ? "" : value);
    startTransition(async () => {
      const res = await setLeadTemperature(form);
      if (!res.ok) setError(res.error ?? "No se pudo etiquetar.");
      router.refresh();
    });
  }

  async function saveNotes(id: string, notes: string) {
    const form = new FormData();
    form.set("id", id);
    form.set("notes", notes);
    await updateLeadNotes(form);
    setEditingNotes(null);
    router.refresh();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`¿Eliminar a ${name}? No se puede deshacer.`)) return;
    const form = new FormData();
    form.set("id", id);
    const res = await deleteLead(form);
    if (!res.ok) setError(res.error ?? "No se pudo eliminar.");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/45">
          Arrastra una tarjeta entre columnas, o usa el selector de cada una.
        </p>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary px-5 py-2 text-sm">
            <Plus className="h-4 w-4" /> Agregar lead
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold text-white">Nuevo lead</h2>
              <p className="text-sm text-white/45">
                Para quien llega por WhatsApp, Instagram o en persona.
              </p>
            </div>
            <button type="button" onClick={() => setShowForm(false)} aria-label="Cerrar"
              className="rounded-lg p-1.5 text-white/40 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="full_name">Nombre</label>
              <input id="full_name" name="full_name" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="whatsapp">WhatsApp</label>
              <input id="whatsapp" name="whatsapp" type="tel" className="input" placeholder="+56 9 …" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="motivation">Qué busca</label>
              <select id="motivation" name="motivation" defaultValue="social_run" className="input">
                {MOTIVATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-stride-card">{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="status">Columna</label>
              <select id="status" name="status" defaultValue="nuevo" className="input">
                {COLUMNS.map((c) => (
                  <option key={c.value} value={c.value} className="bg-stride-card">{c.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">Nota</label>
              <textarea id="notes" name="notes" rows={2} className="input resize-y"
                placeholder="Dónde lo conociste, qué conversaron…" />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear lead"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && !showForm && (
        <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
      )}

      {/* Tablero */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = leads.filter((l) => l.status === col.value);
          return (
            <section
              key={col.value}
              onDragOver={(e) => { e.preventDefault(); setOverColumn(col.value); }}
              onDragLeave={() => setOverColumn(null)}
              onDrop={(e) => handleDrop(e, col.value)}
              className={`rounded-2xl border-2 border-dashed p-3 transition ${
                overColumn === col.value ? "border-stride-cyan bg-stride-cyan/5" : col.tone
              }`}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-white/80">
                  {col.label}
                </h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/60">
                  {items.length}
                </span>
              </header>

              <ul className="space-y-2">
                {items.map((lead) => {
                  const wa = lead.whatsapp?.replace(/[^0-9]/g, "");
                  return (
                    <li
                      key={lead.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", lead.id);
                        setDragging(lead.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                      className={`cursor-grab rounded-xl bg-stride-card p-3 active:cursor-grabbing ${
                        dragging === lead.id ? "opacity-40" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-white/20" />
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => setOpenLead(openLead === lead.id ? null : lead.id)}
                            className="block w-full truncate text-left text-sm font-medium text-white hover:text-stride-cyan">
                            {lead.full_name}
                          </button>
                          {(lead.tags?.length ?? 0) > 0 && (
                            <p className="mt-1 flex flex-wrap gap-1">
                              {lead.tags!.map((t) => (
                                <span key={t} className="rounded-full bg-stride-indigo/15 px-1.5 py-px text-[10px] font-semibold text-stride-indigo">#{t}</span>
                              ))}
                            </p>
                          )}
                          <p className="mt-0.5 text-xs text-stride-cyan/80">
                            {MOTIVATION_LABELS[lead.motivation] ?? lead.motivation}
                          </p>
                          <p className="mt-0.5 text-[11px] text-white/35">
                            {new Date(lead.created_at).toLocaleDateString("es-CL", {
                              timeZone: "America/Santiago",
                            })}
                            {lead.source === "manual" && " · manual"}
                          </p>
                        </div>
                      </div>

                      {editingNotes === lead.id ? (
                        <textarea
                          autoFocus
                          defaultValue={lead.notes ?? ""}
                          rows={3}
                          onBlur={(e) => saveNotes(lead.id, e.target.value)}
                          className="input mt-2 resize-y text-xs"
                          placeholder="Escribe y haz click fuera para guardar"
                        />
                      ) : (
                        openLead === lead.id && lead.notes && (
                          <p className="mt-2 whitespace-pre-line rounded-lg bg-white/5 p-2 text-[11px] leading-snug text-white/55">
                            {lead.notes}
                          </p>
                        )
                      )}

                      {openLead === lead.id && (
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {(lead.tags ?? []).map((t) => (
                            <button key={t} type="button" title="Quitar etiqueta" disabled={pending}
                              onClick={() => saveTags(lead.id, (lead.tags ?? []).filter((x) => x !== t))}
                              className="rounded-full border border-stride-indigo/40 px-2 py-0.5 text-[10px] font-semibold text-stride-indigo hover:bg-red-500/10 hover:text-red-300">
                              #{t} ×
                            </button>
                          ))}
                          <span className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5">
                            <Tag className="h-3 w-3 text-white/30" />
                            <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && tagDraft.trim()) {
                                  e.preventDefault();
                                  saveTags(lead.id, [...(lead.tags ?? []), tagDraft.trim().replace(/^#/, "")]);
                                  setTagDraft("");
                                }
                              }}
                              placeholder="etiqueta ⏎" className="w-20 bg-transparent text-[10px] text-white outline-none placeholder:text-white/30" />
                          </span>
                        </div>
                      )}

                      <div className="mt-2.5 flex items-center gap-1 border-t border-white/5 pt-2.5">
                        {TEMPERATURES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            disabled={pending}
                            onClick={() => setTemperature(lead.id, lead.temperature ?? null, t.value)}
                            title={`Marcar ${t.label.toLowerCase()}`}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                              lead.temperature === t.value ? t.active : "border-white/10 text-white/30 hover:text-white/60"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        {wa && (
                          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"
                            aria-label={`WhatsApp de ${lead.full_name}`}
                            className="rounded-md p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {lead.email && !lead.email.endsWith("@stride.local") && (
                          <a href={`mailto:${lead.email}`} aria-label={`Email de ${lead.full_name}`}
                            className="rounded-md p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white">
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button type="button" onClick={() => setEditingNotes(lead.id)}
                          aria-label="Editar nota"
                          className="rounded-md p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white">
                          <StickyNote className="h-3.5 w-3.5" />
                        </button>
                        {canDelete && (
                          <button type="button" onClick={() => remove(lead.id, lead.full_name)}
                            aria-label="Eliminar lead"
                            className="ml-auto rounded-md p-1.5 text-white/30 transition hover:bg-red-500/10 hover:text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Alternativa accesible al arrastrar */}
                      <select
                        value={lead.status}
                        disabled={pending}
                        onChange={(e) => move(lead.id, e.target.value as Status)}
                        aria-label={`Mover ${lead.full_name}`}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.value} value={c.value} className="bg-stride-card">
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}

                {items.length === 0 && (
                  <li className="rounded-xl border border-dashed border-white/10 py-6 text-center text-xs text-white/25">
                    Vacío
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
