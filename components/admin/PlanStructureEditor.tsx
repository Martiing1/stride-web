"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Calculator, ClipboardList, Flag, Loader2, PartyPopper, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { savePlanStructure } from "@/app/admin/planificaciones/actions";

// ─── Tipos del editor (espejo de la migración 004) ───────────────────────────

type Section = "inicio" | "final" | "social";

interface BlockRow {
  section: Section;
  block_time: string;
  leader_label: string;
  activity: string;
  notes: string;
}

interface GroupRow {
  name: string;
  distance_km: string;
  pace_label: string; // "7:30" min/km, como lo escribe el equipo
  break_min: string;
  leaders: string;
}

interface ChecklistRow {
  label: string;
  done: boolean;
}

const SECTIONS: Array<{ id: Section; label: string; icon: typeof Flag; hint: string }> = [
  { id: "inicio", label: "Inicio", icon: Flag, hint: "Llegada, recepción, saludos, dinámica y calentamiento." },
  { id: "final", label: "Final running", icon: Sparkles, hint: "Elongación, foto, sampling, sorteos y cierre." },
  { id: "social", label: "Espacio social", icon: PartyPopper, hint: "Entrada al local, conversación guiada, foto oficial." },
];

// Plantilla estándar: la estructura real de los social runs.
const TEMPLATE_BLOCKS: BlockRow[] = [
  { section: "inicio", block_time: "", leader_label: "Monitores", activity: "Llegada del equipo", notes: "Llegar con anticipación para preparar actividades" },
  { section: "inicio", block_time: "", leader_label: "", activity: "Recepción de participantes", notes: "" },
  { section: "inicio", block_time: "", leader_label: "", activity: "Escaneo QR / validación de inscritos", notes: "" },
  { section: "inicio", block_time: "", leader_label: "", activity: "Saludo 1 — bienvenida y sentido de STRIDE", notes: "Primerizos + origen de la comunidad" },
  { section: "inicio", block_time: "", leader_label: "", activity: "Saludo 2 — ruta y agradecimiento al colaborador", notes: "" },
  { section: "inicio", block_time: "", leader_label: "", activity: "Dinámica rompehielo", notes: "" },
  { section: "inicio", block_time: "", leader_label: "", activity: "Calentamiento", notes: "Movilidad, activación, estiramiento guiado" },
  { section: "final", block_time: "", leader_label: "", activity: "Elongación", notes: "Partir a medida que van llegando" },
  { section: "final", block_time: "", leader_label: "", activity: "Foto grupal + grito STRIDE", notes: "" },
  { section: "final", block_time: "", leader_label: "", activity: "Sorteo / premios", notes: "" },
  { section: "final", block_time: "", leader_label: "", activity: "Cierre", notes: "" },
  { section: "social", block_time: "", leader_label: "Equipo STRIDE", activity: "Entrada al local", notes: "Logística de asientos" },
  { section: "social", block_time: "", leader_label: "", activity: "Conversación guiada / juego", notes: "" },
  { section: "social", block_time: "", leader_label: "", activity: "Foto oficial del espacio social", notes: "" },
  { section: "social", block_time: "", leader_label: "", activity: "Cierre del evento", notes: "" },
];

const TEMPLATE_GROUPS: GroupRow[] = [
  { name: "3K principiantes", distance_km: "3", pace_label: "7:30", break_min: "0", leaders: "" },
  { name: "5K intermedio", distance_km: "5", pace_label: "6:30", break_min: "0", leaders: "" },
  { name: "5K avanzado", distance_km: "5", pace_label: "5:15", break_min: "0", leaders: "" },
];

const TEMPLATE_CHECKLIST: string[] = [
  "Domingo: revisar pronóstico de lluvia y lanzar encuesta de asistencia",
  "Martes: planificación, ruta y líderes listos",
  "Ruta trazada y GPX exportado (72 h antes)",
  "Líderes de comunidad confirmados por grupo",
  "Colaborador confirmado (qué aporta y a qué hora llega)",
  "Materiales listos: conos, hidratación, botiquín, parlante",
  "Evento publicado en Evently y en la web",
];

// ─── Paces ───────────────────────────────────────────────────────────────────

function paceToSeconds(label: string): number | null {
  const match = label.trim().match(/^(\d{1,2})[:.'](\d{1,2})$/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const asNumber = Number(label.replace(",", "."));
  // "6.5" = 6 minutos y medio
  if (Number.isFinite(asNumber) && asNumber > 2 && asNumber < 20) return Math.round(asNumber * 60);
  return null;
}

function secondsToPace(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

interface ComputedGroup {
  totalMin: number | null;
  offsetMin: number | null;
}

/**
 * Salidas escalonadas: cada grupo corre su distancia a su pace y suma su
 * propio descanso; el que demora más sale primero y el resto se atrasa para
 * que todos lleguen a la misma hora.
 */
function computeOffsets(groups: GroupRow[]): ComputedGroup[] {
  const totals = groups.map((g) => {
    const pace = paceToSeconds(g.pace_label);
    const distance = Number(g.distance_km.replace(",", "."));
    const rest = Number(g.break_min) || 0;
    if (!pace || !Number.isFinite(distance) || distance <= 0) return null;
    return (pace * distance) / 60 + rest;
  });
  const valid = totals.filter((t): t is number => t != null);
  const slowest = valid.length ? Math.max(...valid) : null;
  return totals.map((total) => ({
    totalMin: total,
    offsetMin: total != null && slowest != null ? Math.round(slowest - total) : null,
  }));
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ─── Editor ──────────────────────────────────────────────────────────────────

export function PlanStructureEditor({
  eventId,
  meetingTime,
  initialBlocks,
  initialGroups,
  initialChecklist,
}: {
  eventId: string;
  meetingTime: string | null;
  initialBlocks: BlockRow[];
  initialGroups: Array<Omit<GroupRow, "pace_label" | "distance_km" | "break_min"> & { distance_km: number; pace_sec_per_km: number; break_min: number }>;
  initialChecklist: ChecklistRow[];
}) {
  const [blocks, setBlocks] = useState<BlockRow[]>(initialBlocks);
  const [groups, setGroups] = useState<GroupRow[]>(
    initialGroups.map((g) => ({
      name: g.name,
      distance_km: String(g.distance_km),
      pace_label: secondsToPace(g.pace_sec_per_km),
      break_min: String(g.break_min),
      leaders: g.leaders ?? "",
    }))
  );
  const [checklist, setChecklist] = useState<ChecklistRow[]>(initialChecklist);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const computed = useMemo(() => computeOffsets(groups), [groups]);
  const isEmpty = blocks.length === 0 && groups.length === 0 && checklist.length === 0;

  function loadTemplate() {
    if (blocks.length === 0) setBlocks(TEMPLATE_BLOCKS);
    if (groups.length === 0) setGroups(TEMPLATE_GROUPS);
    if (checklist.length === 0) setChecklist(TEMPLATE_CHECKLIST.map((label) => ({ label, done: false })));
  }

  function save() {
    setMessage(null);
    const payload = {
      event_id: eventId,
      blocks: blocks.filter((b) => b.activity.trim()),
      groups: groups
        .map((g, i) => ({
          name: g.name,
          distance_km: Number(g.distance_km.replace(",", ".")),
          pace_sec_per_km: paceToSeconds(g.pace_label) ?? 0,
          break_min: Number(g.break_min) || 0,
          leaders: g.leaders,
          start_offset_min: computed[i]?.offsetMin ?? 0,
        }))
        .filter((g) => g.name.trim() && g.pace_sec_per_km > 0 && g.distance_km > 0),
      checklist: checklist.filter((c) => c.label.trim()),
    };
    const form = new FormData();
    form.set("payload", JSON.stringify(payload));
    startTransition(async () => {
      const result = await savePlanStructure(form);
      setMessage(result.ok ? { tone: "ok", text: "Estructura guardada." } : { tone: "error", text: result.error ?? "No se pudo guardar." });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-bold text-white">Itinerario del día</h2>
        {isEmpty && (
          <button type="button" onClick={loadTemplate} className="btn-secondary text-sm">
            <Sparkles className="h-4 w-4" /> Cargar plantilla estándar
          </button>
        )}
      </div>

      {/* Grupos de ritmo + salidas escalonadas */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-heading font-bold text-white">
            <Calculator className="h-5 w-5 text-stride-cyan" /> Grupos y salidas escalonadas
          </h3>
          <button type="button" onClick={() => setGroups((g) => [...g, { name: "", distance_km: "", pace_label: "", break_min: "0", leaders: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white">
            <Plus className="h-3.5 w-3.5" /> Grupo
          </button>
        </div>
        <p className="text-sm text-white/45">
          Cada grupo corre a su pace y descansa por su cuenta; la salida se calcula para que
          todos lleguen a la misma hora{meetingTime ? ` (base ${meetingTime.slice(0, 5)} hrs)` : ""}.
        </p>

        {groups.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-white/35">
                  <th className="pb-2 pr-3 font-medium">Grupo</th>
                  <th className="pb-2 pr-3 font-medium">Km</th>
                  <th className="pb-2 pr-3 font-medium">Pace</th>
                  <th className="pb-2 pr-3 font-medium">Descanso</th>
                  <th className="pb-2 pr-3 font-medium">Líderes</th>
                  <th className="pb-2 pr-3 font-medium">Duración</th>
                  <th className="pb-2 pr-3 font-medium">Salida</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {groups.map((group, i) => {
                  const c = computed[i];
                  return (
                    <tr key={i} className="border-t border-white/5 align-middle">
                      <td className="py-2 pr-3"><input value={group.name} onChange={(e) => setGroups(patch(groups, i, { name: e.target.value }))} className="input px-2.5 py-1.5 text-sm" placeholder="3K principiantes" /></td>
                      <td className="py-2 pr-3 w-20"><input value={group.distance_km} onChange={(e) => setGroups(patch(groups, i, { distance_km: e.target.value }))} inputMode="decimal" className="input px-2.5 py-1.5 text-sm" placeholder="5" /></td>
                      <td className="py-2 pr-3 w-24"><input value={group.pace_label} onChange={(e) => setGroups(patch(groups, i, { pace_label: e.target.value }))} className="input px-2.5 py-1.5 text-sm" placeholder="6:30" /></td>
                      <td className="py-2 pr-3 w-24"><input value={group.break_min} onChange={(e) => setGroups(patch(groups, i, { break_min: e.target.value }))} inputMode="numeric" className="input px-2.5 py-1.5 text-sm" placeholder="0" /></td>
                      <td className="py-2 pr-3"><input value={group.leaders} onChange={(e) => setGroups(patch(groups, i, { leaders: e.target.value }))} className="input px-2.5 py-1.5 text-sm" placeholder="Tebo, Gemma" /></td>
                      <td className="py-2 pr-3 whitespace-nowrap text-white/60">{c?.totalMin != null ? `${Math.round(c.totalMin)} min` : "—"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap font-semibold text-stride-cyan">
                        {c?.offsetMin == null ? "—" : meetingTime ? addMinutes(meetingTime.slice(0, 5), c.offsetMin) : c.offsetMin === 0 ? "1ª salida" : `+${c.offsetMin} min`}
                      </td>
                      <td className="py-2 text-right"><RemoveButton onClick={() => setGroups(groups.filter((_, j) => j !== i))} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bloques del itinerario */}
      {SECTIONS.map(({ id, label, icon: Icon, hint }) => {
        const rows = blocks.map((b, index) => ({ ...b, index })).filter((b) => b.section === id);
        return (
          <section key={id} className="card space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-heading font-bold text-white">
                <Icon className="h-5 w-5 text-stride-cyan" /> {label}
              </h3>
              <button type="button" onClick={() => setBlocks((b) => [...b, { section: id, block_time: "", leader_label: "", activity: "", notes: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white">
                <Plus className="h-3.5 w-3.5" /> Bloque
              </button>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-white/35">{hint}</p>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.index} className="grid grid-cols-[90px_1fr_32px] items-start gap-2 sm:grid-cols-[90px_150px_1fr_1fr_32px]">
                    <input type="time" value={row.block_time} onChange={(e) => setBlocks(patch(blocks, row.index, { block_time: e.target.value }))} className="input px-2.5 py-1.5 text-sm" />
                    <input value={row.leader_label} onChange={(e) => setBlocks(patch(blocks, row.index, { leader_label: e.target.value }))} className="input px-2.5 py-1.5 text-sm max-sm:col-start-2" placeholder="Encargado" />
                    <input value={row.activity} onChange={(e) => setBlocks(patch(blocks, row.index, { activity: e.target.value }))} className="input px-2.5 py-1.5 text-sm max-sm:col-span-2" placeholder="Actividad" />
                    <input value={row.notes} onChange={(e) => setBlocks(patch(blocks, row.index, { notes: e.target.value }))} className="input px-2.5 py-1.5 text-sm max-sm:col-span-2" placeholder="Notas" />
                    <RemoveButton onClick={() => setBlocks(blocks.filter((_, j) => j !== row.index))} />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Checklist */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-heading font-bold text-white">
            <ClipboardList className="h-5 w-5 text-stride-cyan" /> Checklist
          </h3>
          <button type="button" onClick={() => setChecklist((c) => [...c, { label: "", done: false }])} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white">
            <Plus className="h-3.5 w-3.5" /> Ítem
          </button>
        </div>
        {checklist.length === 0 ? (
          <p className="text-sm text-white/35">Lo que tiene que estar listo antes del evento.</p>
        ) : (
          <ul className="space-y-2">
            {checklist.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <input type="checkbox" checked={item.done} onChange={(e) => setChecklist(patch(checklist, i, { done: e.target.checked }))} className="h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-[#7C3AED]" />
                <input value={item.label} onChange={(e) => setChecklist(patch(checklist, i, { label: e.target.value }))} className={`input flex-1 px-2.5 py-1.5 text-sm ${item.done ? "text-white/35 line-through" : ""}`} placeholder="Ruta trazada y GPX exportado" />
                <RemoveButton onClick={() => setChecklist(checklist.filter((_, j) => j !== i))} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && (
        <p className={`rounded-xl border p-3 text-sm ${message.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-red-400/30 bg-red-500/10 text-red-200"}`}>
          {message.text}
        </p>
      )}

      <button type="button" onClick={save} disabled={pending} className="btn-primary">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Guardar itinerario</>}
      </button>
    </div>
  );
}

function patch<T>(list: T[], index: number, changes: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...changes } : item));
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Quitar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/30 hover:border-red-400/40 hover:text-red-300">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
