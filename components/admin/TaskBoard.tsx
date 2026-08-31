"use client";

import { useEffect, useMemo, useState, useTransition, type DragEvent, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Loader2, X, ListTodo, Check, Columns3, Rows3, CalendarDays, UserRound, Tag, FileText, Lock, History, Trash2 } from "lucide-react";
import { updateTaskStatus, createTask, updateTaskNotes, updateTask, getTaskHistory, deleteTask, type TaskHistoryEntry } from "@/app/admin/tareas/actions";
import type { Task, TeamMember, TaskStatus } from "@/lib/types";

const STATUS_ORDER: TaskStatus[] = ["pendiente", "en_progreso", "bloqueada", "recurrente", "hecha"];

const PRIORITY_STYLES: Record<string, string> = {
  alta: "bg-red-500/15 text-red-400",
  media: "bg-amber-500/15 text-amber-400",
  baja: "bg-white/10 text-white/50",
};

const COLUMN_TONES: Record<TaskStatus, string> = {
  pendiente: "border-white/15",
  en_progreso: "border-stride-cyan/40",
  bloqueada: "border-red-400/40",
  recurrente: "border-indigo-400/40",
  hecha: "border-emerald-400/40",
};

export function TaskBoard({
  tasks,
  team,
  currentMemberId,
  canCreate,
  isSocio,
  today,
  activeAssignee,
  activeStatus,
  statusLabels,
}: {
  tasks: Task[];
  team: TeamMember[];
  currentMemberId: string;
  canCreate: boolean;
  isSocio: boolean;
  today: string;
  activeAssignee: string;
  activeStatus: string;
  statusLabels: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [draft, setDraft] = useState({ title: "", assignee_id: "", area: "", priority: "media", due_date: "", visibility: "equipo" });
  const [history, setHistory] = useState<TaskHistoryEntry[] | null>(null);
  // Filtros locales: los datos ya están cargados, no hace falta otro viaje.
  const [priorityFilter, setPriorityFilter] = useState("todas");
  const [areaFilter, setAreaFilter] = useState("todas");
  const [onlySocios, setOnlySocios] = useState(false);

  // La vista elegida se recuerda por navegador.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("stride-task-view");
      if (stored === "kanban" || stored === "lista") setView(stored);
    } catch {}
  }, []);
  function switchView(next: "lista" | "kanban") {
    setView(next);
    try { window.localStorage.setItem("stride-task-view", next); } catch {}
  }

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "todos" && key === "responsable") params.delete(key);
    else params.set(key, value);
    router.push(`/admin/tareas?${params.toString()}`);
  }

  function changeStatus(id: string, status: TaskStatus) {
    const form = new FormData();
    form.set("id", id);
    form.set("status", status);
    startTransition(async () => {
      const res = await updateTaskStatus(form);
      if (!res.ok) setError(res.error ?? "No se pudo actualizar.");
      setOpenTask(null);
      router.refresh();
    });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const form = event.currentTarget;
    const res = await createTask(new FormData(form));
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "No se pudo crear."); return; }
    form.reset();
    setShowForm(false);
    router.refresh();
  }

  const nameOf = (task: Task) => {
    const person = team.find((t) => t.id === task.assignee_id);
    return person ? (person.nickname ?? person.full_name) : (task.assignee_label ?? "Sin asignar");
  };

  const areas = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.area).filter((a): a is string => Boolean(a)))).sort(),
    [tasks]
  );

  const visible = tasks.filter(
    (t) =>
      (priorityFilter === "todas" || t.priority === priorityFilter) &&
      (areaFilter === "todas" || t.area === areaFilter) &&
      (!onlySocios || t.visibility === "socios")
  );

  function openDetail(task: Task) {
    setOpenTask(task);
    setNoteDraft(task.description ?? "");
    setNoteSaved(false);
    setDraft({
      title: task.title,
      assignee_id: task.assignee_id ?? "",
      area: task.area ?? "",
      priority: task.priority,
      due_date: task.due_date ?? "",
      visibility: task.visibility ?? "equipo",
    });
    setHistory(null);
    const form = new FormData();
    form.set("id", task.id);
    void getTaskHistory(form).then((res) => setHistory(res.entries));
  }

  function removeTask() {
    if (!openTask) return;
    if (!window.confirm(`¿Eliminar «${openTask.title.slice(0, 60)}»? Se borra con su historial y no se puede deshacer.`)) return;
    const form = new FormData();
    form.set("id", openTask.id);
    startTransition(async () => {
      const res = await deleteTask(form);
      if (!res.ok) { setError(res.error ?? "No se pudo eliminar."); return; }
      setOpenTask(null);
      router.refresh();
    });
  }

  function saveEdit() {
    if (!openTask) return;
    const form = new FormData();
    form.set("id", openTask.id);
    form.set("title", draft.title);
    form.set("assignee_id", draft.assignee_id);
    form.set("area", draft.area);
    form.set("priority", draft.priority);
    form.set("due_date", draft.due_date);
    form.set("visibility", draft.visibility);
    startTransition(async () => {
      const res = await updateTask(form);
      if (!res.ok) { setError(res.error ?? "No se pudo guardar."); return; }
      setOpenTask(null);
      router.refresh();
    });
  }

  function saveNote() {
    if (!openTask) return;
    const form = new FormData();
    form.set("id", openTask.id);
    form.set("description", noteDraft);
    startTransition(async () => {
      const res = await updateTaskNotes(form);
      if (res.ok) {
        setNoteSaved(true);
        router.refresh();
      } else setError(res.error ?? "No se pudo guardar la nota.");
    });
  }

  function handleDrop(event: DragEvent, status: TaskStatus) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/task-id");
    const current = tasks.find((t) => t.id === id);
    if (id && current && current.status !== status) changeStatus(id, status);
  }

  return (
    <div className="space-y-6">
      {/* Filtros + vista */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={activeAssignee} onChange={(e) => setFilter("responsable", e.target.value)} aria-label="Filtrar por responsable" className="input w-auto py-2 text-sm">
          <option value="todos" className="bg-stride-card">Todo el equipo</option>
          <option value={currentMemberId} className="bg-stride-card">Solo mis tareas</option>
          {team.map((t) => (
            <option key={t.id} value={t.id} className="bg-stride-card">{t.nickname ?? t.full_name}</option>
          ))}
        </select>

        <select value={activeStatus} onChange={(e) => setFilter("estado", e.target.value)} aria-label="Filtrar por estado" className="input w-auto py-2 text-sm">
          <option value="abiertas" className="bg-stride-card">Abiertas</option>
          <option value="todos" className="bg-stride-card">Todas</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s} className="bg-stride-card">{statusLabels[s] ?? s}</option>
          ))}
        </select>

        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Filtrar por prioridad" className="input w-auto py-2 text-sm">
          <option value="todas" className="bg-stride-card">Toda prioridad</option>
          <option value="alta" className="bg-stride-card">Alta</option>
          <option value="media" className="bg-stride-card">Media</option>
          <option value="baja" className="bg-stride-card">Baja</option>
        </select>

        {areas.length > 0 && (
          <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} aria-label="Filtrar por área" className="input w-auto py-2 text-sm">
            <option value="todas" className="bg-stride-card">Toda área</option>
            {areas.map((a) => (
              <option key={a} value={a} className="bg-stride-card">{a}</option>
            ))}
          </select>
        )}

        {isSocio && (
          <button
            type="button"
            onClick={() => setOnlySocios(!onlySocios)}
            title="Ver solo las tareas de socios"
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition ${onlySocios ? "border-stride-amber/60 bg-stride-amber/15 text-stride-amber" : "border-white/10 text-white/50 hover:text-white"}`}
          >
            <Lock className="h-3.5 w-3.5" /> Solo socios
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-full border border-white/10 p-0.5">
            {([["lista", Rows3], ["kanban", Columns3]] as const).map(([mode, Icon]) => (
              <button key={mode} type="button" onClick={() => switchView(mode)} aria-label={`Vista ${mode}`} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${view === mode ? "bg-stride-accent/20 text-white" : "text-white/40 hover:text-white"}`}>
                <Icon className="mr-1 inline h-3.5 w-3.5" /> {mode}
              </button>
            ))}
          </div>
          {canCreate && !showForm && (
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary px-5 py-2 text-sm">
              <Plus className="h-4 w-4" /> Nueva tarea
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-white">Nueva tarea</h2>
            <button type="button" onClick={() => setShowForm(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-white/40 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div>
            <label className="label" htmlFor="title">Tarea</label>
            <input id="title" name="title" required className="input" />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label" htmlFor="assignee_id">Responsable</label>
              <select id="assignee_id" name="assignee_id" className="input" defaultValue="">
                <option value="" className="bg-stride-card">Sin asignar</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id} className="bg-stride-card">{t.nickname ?? t.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="area">Área</label>
              <input id="area" name="area" className="input" placeholder="Operaciones" />
            </div>
            <div>
              <label className="label" htmlFor="priority">Prioridad</label>
              <select id="priority" name="priority" defaultValue="media" className="input">
                <option value="alta" className="bg-stride-card">Alta</option>
                <option value="media" className="bg-stride-card">Media</option>
                <option value="baja" className="bg-stride-card">Baja</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="due_date">Fecha límite</label>
              <input id="due_date" name="due_date" type="date" className="input" />
            </div>
          </div>
          {isSocio && (
            <label className="flex w-fit cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70">
              <input type="checkbox" name="visibility" value="socios" className="h-4 w-4 accent-[#7C3AED]" />
              <Lock className="h-3.5 w-3.5 text-stride-amber" /> Solo socios (tú y JJ; el resto del equipo ni la ve)
            </label>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear tarea"}
          </button>
        </form>
      )}

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

      {visible.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <ListTodo className="h-10 w-10 text-white/25" />
          <p className="text-sm text-white/50">No hay tareas con estos filtros.</p>
        </div>
      ) : view === "lista" ? (
        <ul className="space-y-2">
          {visible.map((task) => {
            const overdue = task.due_date && task.due_date < today && task.status !== "hecha";
            return (
              <li key={task.id}>
                <button type="button" onClick={() => openDetail(task)} className={`card flex w-full flex-wrap items-center gap-4 py-4 text-left transition hover:border-white/20 ${overdue ? "border-red-500/30" : ""}`}>
                  <div className="min-w-[200px] flex-1">
                    <p className={`text-sm ${task.status === "hecha" ? "text-white/40 line-through" : "text-white"}`}>
                      {task.visibility === "socios" && <Lock className="mr-1.5 inline h-3 w-3 text-stride-amber" aria-label="Solo socios" />}
                      {task.title}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 font-semibold text-white/70">
                        <UserRound className="h-3 w-3" /> {nameOf(task)}
                      </span>
                      {task.area && <span>{task.area}</span>}
                      {task.due_date && (
                        <span className={overdue ? "text-red-400" : ""}>
                          {overdue ? "venció " : "vence "}
                          {task.due_date.split("-").reverse().join("/")}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
                  {task.status !== "hecha" ? (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); changeStatus(task.id, "hecha"); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); changeStatus(task.id, "hecha"); } }}
                      title="Marcar como hecha"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
                    >
                      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Hecha
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">{statusLabels.hecha ?? "Hecha"}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[900px] grid-cols-5 gap-3">
            {STATUS_ORDER.map((status) => {
              const items = visible.filter((t) => t.status === status);
              return (
                <div key={status} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, status)} className={`rounded-2xl border border-t-2 border-white/5 bg-white/[0.02] p-3 ${COLUMN_TONES[status]}`}>
                  <p className="mb-3 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-white/50">
                    {statusLabels[status] ?? status}
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">{items.length}</span>
                  </p>
                  <div className="space-y-2">
                    {items.map((task) => {
                      const overdue = task.due_date && task.due_date < today && task.status !== "hecha";
                      return (
                        <button
                          key={task.id}
                          type="button"
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/task-id", task.id)}
                          onClick={() => openDetail(task)}
                          className={`w-full cursor-grab rounded-xl border border-white/5 bg-stride-card p-3 text-left text-sm transition hover:border-white/20 active:cursor-grabbing ${overdue ? "border-red-500/30" : ""}`}
                        >
                          <p className={task.status === "hecha" ? "text-white/40 line-through" : "text-white"}>
                            {task.visibility === "socios" && <Lock className="mr-1 inline h-3 w-3 text-stride-amber" aria-label="Solo socios" />}
                            {task.title}
                          </p>
                          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/40">
                            <span className="rounded-full bg-white/5 px-1.5 py-0.5 font-semibold text-white/65">{nameOf(task)}</span>
                            <span className={`rounded-full px-1.5 py-0.5 font-semibold ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
                            {task.due_date && <span className={overdue ? "text-red-400" : ""}>{task.due_date.split("-").reverse().join("/")}</span>}
                          </p>
                        </button>
                      );
                    })}
                    {status === "hecha" && items.length === 0 && activeStatus === "abiertas" && (
                      <p className="px-1 text-[11px] leading-relaxed text-white/25">Las hechas están ocultas: usa el filtro «Todas» para verlas.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Popup de detalle: editable para staff, con historial de cambios */}
      {openTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpenTask(null)} role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-stride-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
                {openTask.visibility === "socios" && <Lock className="h-3.5 w-3.5 text-stride-amber" />} Tarea
              </p>
              <button type="button" onClick={() => setOpenTask(null)} aria-label="Cerrar" className="rounded-lg p-1.5 text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {canCreate ? (
              <div className="mt-3 space-y-4">
                <div>
                  <label htmlFor="edit-title" className="label">Tarea</label>
                  <textarea id="edit-title" rows={2} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="input resize-none text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="edit-assignee" className="label">Responsable</label>
                    <select id="edit-assignee" value={draft.assignee_id} onChange={(e) => setDraft({ ...draft, assignee_id: e.target.value })} className="input py-2 text-sm">
                      <option value="" className="bg-stride-card">Sin asignar</option>
                      {team.map((t) => (
                        <option key={t.id} value={t.id} className="bg-stride-card">{t.nickname ?? t.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edit-due" className="label">Fecha límite</label>
                    <input id="edit-due" type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} className="input py-2 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="edit-priority" className="label">Prioridad</label>
                    <select id="edit-priority" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} className="input py-2 text-sm">
                      <option value="alta" className="bg-stride-card">Alta</option>
                      <option value="media" className="bg-stride-card">Media</option>
                      <option value="baja" className="bg-stride-card">Baja</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edit-area" className="label">Área</label>
                    <input id="edit-area" value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} className="input py-2 text-sm" placeholder="Operaciones" />
                  </div>
                </div>
                {isSocio && (
                  <label className="flex w-fit cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70">
                    <input type="checkbox" checked={draft.visibility === "socios"} onChange={(e) => setDraft({ ...draft, visibility: e.target.checked ? "socios" : "equipo" })} className="h-4 w-4 accent-[#7C3AED]" />
                    <Lock className="h-3.5 w-3.5 text-stride-amber" /> Solo socios
                  </label>
                )}
                <button type="button" onClick={saveEdit} disabled={pending} className="btn-primary px-5 py-2.5 text-sm">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Guardar cambios</>}
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <h2 className="font-heading text-xl font-bold text-white">{openTask.title}</h2>
                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex items-center gap-2.5"><UserRound className="h-4 w-4 shrink-0 text-white/30" /><dt className="text-white/40">Responsable</dt><dd className="font-semibold text-white">{nameOf(openTask)}</dd></div>
                  {openTask.area && <div className="flex items-center gap-2.5"><Tag className="h-4 w-4 shrink-0 text-white/30" /><dt className="text-white/40">Área</dt><dd className="text-white/80">{openTask.area}</dd></div>}
                  <div className="flex items-center gap-2.5"><CalendarDays className="h-4 w-4 shrink-0 text-white/30" /><dt className="text-white/40">Fecha límite</dt><dd className="text-white/80">{openTask.due_date ? openTask.due_date.split("-").reverse().join("/") : "Sin fecha"}</dd></div>
                </dl>
              </div>
            )}

            {openTask.meeting_id && (
              <p className="mt-3 flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-white/30" /><a href={`/admin/actas/${openTask.meeting_id}`} className="text-stride-cyan hover:underline">Ver acta de origen</a></p>
            )}

            <div className="mt-4">
              <label htmlFor="task-notes" className="label">Notas</label>
              <textarea
                id="task-notes"
                rows={3}
                value={noteDraft}
                onChange={(e) => { setNoteDraft(e.target.value); setNoteSaved(false); }}
                className="input resize-y text-sm"
                placeholder="Contexto, avances, links…"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveNote}
                  disabled={pending || noteDraft === (openTask.description ?? "")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-white/70 hover:text-white disabled:opacity-40"
                >
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Guardar nota
                </button>
                {noteSaved && <span className="text-xs text-emerald-300">Guardada ✓</span>}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
              {openTask.status !== "hecha" && (
                <button type="button" onClick={() => changeStatus(openTask.id, "hecha")} disabled={pending} className="btn-primary px-5 py-2.5 text-sm">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Marcar como hecha</>}
                </button>
              )}
              <select
                value={openTask.status}
                disabled={pending}
                onChange={(e) => changeStatus(openTask.id, e.target.value as TaskStatus)}
                aria-label="Cambiar estado"
                className="input w-auto py-2 text-sm"
              >
                {STATUS_ORDER.map((st) => (
                  <option key={st} value={st} className="bg-stride-card">{statusLabels[st] ?? st}</option>
                ))}
              </select>
              {isSocio && (
                <button
                  type="button"
                  onClick={removeTask}
                  disabled={pending}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/40 transition hover:border-red-400/40 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </button>
              )}
            </div>

            {/* Historial de cambios */}
            <div className="mt-5 border-t border-white/5 pt-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">
                <History className="h-3.5 w-3.5" /> Historial
              </p>
              {history === null ? (
                <p className="mt-2 text-xs text-white/30">Cargando…</p>
              ) : history.length === 0 ? (
                <p className="mt-2 text-xs text-white/30">Sin cambios registrados aún.</p>
              ) : (
                <ul className="mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  {history.map((entry, i) => (
                    <li key={i} className="text-xs leading-relaxed text-white/50">
                      <span className="font-semibold text-white/70">{entry.who}</span> cambió {entry.field}
                      {entry.old_value ? <> de «{entry.old_value.slice(0, 40)}»</> : null}
                      {entry.new_value ? <> a «{entry.new_value.slice(0, 40)}»</> : <> (lo dejó vacío)</>}
                      <span className="text-white/30"> · {new Date(entry.created_at).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
