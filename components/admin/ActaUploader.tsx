"use client";

import { useEffect, useState, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, ListTodo, Gavel, Eye, Lock } from "lucide-react";
import { parseActa, type ParsedTask } from "@/lib/acta-parser";
import { saveActa, type SaveActaResult } from "@/app/admin/actas/actions";

/**
 * Formulario para subir un acta ya redactada.
 *
 * Muestra en vivo qué va a extraer del bloque AUTO_PROCESSING antes de guardar,
 * para que se pueda corregir el texto si algo salió mal en vez de terminar con
 * tareas basura en el sistema. El servidor vuelve a parsear al guardar.
 */
type EditableTask = ParsedTask & { visibility: "equipo" | "socios" };

export function ActaUploader({ isSocio }: { isSocio: boolean }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [attendees, setAttendees] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveActaResult | null>(null);

  const preview = useMemo(() => (content.trim() ? parseActa(content) : null), [content]);
  // Copia editable de las tareas: acá se corrigen fechas "A definir",
  // responsables y prioridades antes de crear nada.
  const [tasks, setTasks] = useState<EditableTask[]>([]);

  // El acta trae su propio encabezado: al pegarla, los campos vacíos se
  // completan solos y cualquier corrección manual del usuario se respeta.
  useEffect(() => {
    setTasks((preview?.tasks ?? []).map((t) => ({ ...t, visibility: "equipo" as const })));
    const header = preview?.header;
    if (!header) return;
    if (header.titleSuggestion) setTitle((v) => v || header.titleSuggestion!);
    if (header.meetingDate) setMeetingDate((v) => v || header.meetingDate!);
    if (header.attendees.length) setAttendees((v) => v || header.attendees.join(", "));
  }, [preview]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setResult(null);

    const form = new FormData(event.currentTarget);
    if (tasks.length > 0) form.set("tasks_override", JSON.stringify(tasks));
    const res = await saveActa(form);
    setResult(res);
    setSaving(false);

    if (res.ok) router.refresh();
  }

  if (result?.ok) {
    return (
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-400" />
          <div>
            <h2 className="font-heading text-xl font-bold text-white">Acta guardada</h2>
            <p className="text-sm text-white/55">
              Se crearon {result.created?.tasks} tareas, {result.created?.decisions} decisiones y{" "}
              {result.created?.followups} seguimientos.
            </p>
          </div>
        </div>

        {result.warnings && result.warnings.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-400">
              <AlertTriangle className="h-4 w-4" /> Revisa esto
            </p>
            <ul className="space-y-1 text-xs leading-relaxed text-amber-200/80">
              {result.warnings.map((w, i) => (
                <li key={i}>· {w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setContent("");
            }}
            className="btn-secondary"
          >
            Subir otra
          </button>
          <a href="/admin/tareas" className="btn-primary">
            Ver tareas
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="title">
              Título
            </label>
            <input
              id="title"
              name="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Reunión operativa"
            />
          </div>
          <div>
            <label className="label" htmlFor="meeting_date">
              Fecha
            </label>
            <input id="meeting_date" name="meeting_date" type="date" required value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="input" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="attendees">
            Asistentes
          </label>
          <input
            id="attendees"
            name="attendees"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            className="input"
            placeholder="Martín, Juanjo, Nico, Fer"
          />
          <p className="mt-1 text-xs text-white/35">Separados por coma.</p>
        </div>

        <div>
          <label className="label" htmlFor="content">
            Acta completa
          </label>
          <textarea
            id="content"
            name="content"
            required
            rows={18}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input resize-y font-mono text-xs leading-relaxed"
            placeholder="Pega acá el acta completa que te devolvió la IA. Reconoce el formato actual (secciones numeradas y tareas NUEVA | …) y el antiguo bloque AUTO_PROCESSING."
          />
        </div>

        {result?.error && (
          <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{result.error}</p>
        )}

        <button type="submit" disabled={saving || !content.trim()} className="btn-primary">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
            </>
          ) : (
            "Guardar acta y crear tareas"
          )}
        </button>
      </div>

      {/* Previsualización del desglose */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="card">
          <p className="mb-4 flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wide text-white/70">
            <Eye className="h-4 w-4 text-stride-accent" />
            Qué se va a crear
          </p>

          {!preview ? (
            <p className="text-sm text-white/40">Pega el acta para ver el desglose.</p>
          ) : !preview.hasBlock ? (
            <p className="rounded-lg bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300">
              No se reconoció ningún formato de tareas (ni secciones con líneas «NUEVA | …» ni
              bloque AUTO_PROCESSING). Se va a guardar igual, pero sin desglosar nada.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { n: tasks.length, label: "Tareas" },
                  { n: preview.decisions.length, label: "Decisiones" },
                  { n: preview.followups.length, label: "Seguim." },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-white/5 py-2">
                    <p className="font-heading text-xl font-bold text-white">{s.n}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">{s.label}</p>
                  </div>
                ))}
              </div>

              {preview.actaCode && (
                <p className="font-mono text-[11px] text-white/35">{preview.actaCode}</p>
              )}

              {tasks.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/60">
                    <ListTodo className="h-3.5 w-3.5" /> Tareas — edítalas antes de guardar
                  </p>
                  <ul className="space-y-2">
                    {tasks.map((t, i) => {
                      const patch = (changes: Partial<EditableTask>) =>
                        setTasks(tasks.map((x, j) => (j === i ? { ...x, ...changes } : x)));
                      return (
                        <li key={i} className="space-y-1.5 rounded-lg bg-white/5 p-2.5">
                          <textarea
                            value={t.title}
                            onChange={(e) => patch({ title: e.target.value })}
                            rows={2}
                            className="w-full resize-none rounded-md border border-transparent bg-transparent text-xs leading-snug text-white/85 focus:border-white/20 focus:outline-none"
                          />
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              value={t.assigneeLabel}
                              onChange={(e) => patch({ assigneeLabel: e.target.value })}
                              className="input px-2 py-1 text-[11px]"
                              placeholder="Responsable"
                              aria-label="Responsable"
                            />
                            <input
                              type="date"
                              value={t.dueDate ?? ""}
                              onChange={(e) => patch({ dueDate: e.target.value || null })}
                              className={`input px-2 py-1 text-[11px] ${t.dueDate ? "" : "border-amber-400/40"}`}
                              aria-label="Fecha límite"
                            />
                            <select
                              value={t.priority}
                              onChange={(e) => patch({ priority: e.target.value as ParsedTask["priority"] })}
                              className="input px-2 py-1 text-[11px]"
                              aria-label="Prioridad"
                            >
                              <option value="alta" className="bg-stride-card">Alta</option>
                              <option value="media" className="bg-stride-card">Media</option>
                              <option value="baja" className="bg-stride-card">Baja</option>
                            </select>
                            <input
                              value={t.area}
                              onChange={(e) => patch({ area: e.target.value })}
                              className="input px-2 py-1 text-[11px]"
                              placeholder="Área"
                              aria-label="Área"
                            />
                          </div>
                          {!t.dueDate && (
                            <p className="text-[10px] text-amber-300/80">Sin fecha (venía "A definir"): ponle una o quedará sin límite.</p>
                          )}
                          {isSocio && (
                            <label className="flex w-fit cursor-pointer items-center gap-1.5 text-[10px] text-white/50">
                              <input
                                type="checkbox"
                                checked={t.visibility === "socios"}
                                onChange={(e) => patch({ visibility: e.target.checked ? "socios" : "equipo" })}
                                className="h-3 w-3 accent-[#7C3AED]"
                              />
                              <Lock className="h-3 w-3 text-stride-amber" /> Solo socios
                            </label>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {preview.decisions.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/60">
                    <Gavel className="h-3.5 w-3.5" /> Decisiones
                  </p>
                  <ul className="space-y-1.5">
                    {preview.decisions.slice(0, 4).map((d, i) => (
                      <li key={i} className="line-clamp-2 text-[11px] leading-snug text-white/50">
                        · {d.content}
                      </li>
                    ))}
                    {preview.decisions.length > 4 && (
                      <li className="text-[11px] text-white/30">
                        y {preview.decisions.length - 4} más…
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {preview.warnings.length > 0 && (
                <div className="rounded-lg bg-amber-500/10 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avisos
                  </p>
                  <ul className="space-y-1 text-[11px] leading-snug text-amber-200/70">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>· {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </form>
  );
}
