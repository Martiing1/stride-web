"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Loader2, X, ListTodo } from "lucide-react";
import { updateTaskStatus, createTask } from "@/app/admin/tareas/actions";
import type { Task, TeamMember, TaskStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
  { value: "hecha", label: "Hecha" },
  { value: "bloqueada", label: "Bloqueada" },
  { value: "recurrente", label: "Recurrente" },
];

const PRIORITY_STYLES: Record<string, string> = {
  alta: "bg-red-500/15 text-red-400",
  media: "bg-amber-500/15 text-amber-400",
  baja: "bg-white/10 text-white/50",
};

export function TaskBoard({
  tasks,
  team,
  currentMemberId,
  canCreate,
  today,
  activeAssignee,
  activeStatus,
}: {
  tasks: Task[];
  team: TeamMember[];
  currentMemberId: string;
  canCreate: boolean;
  today: string;
  activeAssignee: string;
  activeStatus: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    if (!res.ok) {
      setError(res.error ?? "No se pudo crear.");
      return;
    }

    form.reset();
    setShowForm(false);
    router.refresh();
  }

  const nameOf = (task: Task) => {
    const person = team.find((t) => t.id === task.assignee_id);
    return person ? (person.nickname ?? person.full_name) : (task.assignee_label ?? "Sin asignar");
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={activeAssignee}
          onChange={(e) => setFilter("responsable", e.target.value)}
          aria-label="Filtrar por responsable"
          className="input w-auto py-2 text-sm"
        >
          <option value="todos" className="bg-stride-card">
            Todo el equipo
          </option>
          <option value={currentMemberId} className="bg-stride-card">
            Solo mis tareas
          </option>
          {team.map((t) => (
            <option key={t.id} value={t.id} className="bg-stride-card">
              {t.nickname ?? t.full_name}
            </option>
          ))}
        </select>

        <select
          value={activeStatus}
          onChange={(e) => setFilter("estado", e.target.value)}
          aria-label="Filtrar por estado"
          className="input w-auto py-2 text-sm"
        >
          <option value="abiertas" className="bg-stride-card">
            Abiertas
          </option>
          <option value="todos" className="bg-stride-card">
            Todas
          </option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value} className="bg-stride-card">
              {s.label}
            </option>
          ))}
        </select>

        {canCreate && !showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary ml-auto px-5 py-2 text-sm">
            <Plus className="h-4 w-4" /> Nueva tarea
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-white">Nueva tarea</h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-white/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className="label" htmlFor="title">
              Tarea
            </label>
            <input id="title" name="title" required className="input" />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label" htmlFor="assignee_id">
                Responsable
              </label>
              <select id="assignee_id" name="assignee_id" className="input" defaultValue="">
                <option value="" className="bg-stride-card">
                  Sin asignar
                </option>
                {team.map((t) => (
                  <option key={t.id} value={t.id} className="bg-stride-card">
                    {t.nickname ?? t.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="area">
                Área
              </label>
              <input id="area" name="area" className="input" placeholder="Operaciones" />
            </div>
            <div>
              <label className="label" htmlFor="priority">
                Prioridad
              </label>
              <select id="priority" name="priority" defaultValue="media" className="input">
                <option value="alta" className="bg-stride-card">Alta</option>
                <option value="media" className="bg-stride-card">Media</option>
                <option value="baja" className="bg-stride-card">Baja</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="due_date">
                Fecha límite
              </label>
              <input id="due_date" name="due_date" type="date" className="input" />
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear tarea"}
          </button>
        </form>
      )}

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

      {tasks.length > 0 ? (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const overdue =
              task.due_date && task.due_date < today && task.status !== "hecha";

            return (
              <li
                key={task.id}
                className={`card flex flex-wrap items-center gap-4 py-4 ${
                  overdue ? "border-red-500/30" : ""
                }`}
              >
                <div className="min-w-[200px] flex-1">
                  <p className={`text-sm ${task.status === "hecha" ? "text-white/40 line-through" : "text-white"}`}>
                    {task.title}
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    {nameOf(task)}
                    {task.area && ` · ${task.area}`}
                    {task.due_date && (
                      <span className={overdue ? "text-red-400" : ""}>
                        {" · "}
                        {overdue ? "venció " : "vence "}
                        {task.due_date.split("-").reverse().join("/")}
                      </span>
                    )}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    PRIORITY_STYLES[task.priority]
                  }`}
                >
                  {task.priority}
                </span>

                <select
                  value={task.status}
                  disabled={pending}
                  onChange={(e) => changeStatus(task.id, e.target.value as TaskStatus)}
                  aria-label={`Estado de ${task.title}`}
                  className="input w-auto shrink-0 py-1.5 text-xs"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value} className="bg-stride-card">
                      {s.label}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <ListTodo className="h-10 w-10 text-white/25" />
          <p className="text-sm text-white/50">No hay tareas con estos filtros.</p>
        </div>
      )}
    </div>
  );
}
