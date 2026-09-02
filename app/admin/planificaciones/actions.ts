"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface PlanResult {
  ok: boolean;
  error?: string;
}

const uuidOrEmpty = z.string().uuid().or(z.literal(""));

const PlanSchema = z.object({
  event_id: z.string().uuid(),
  route_id: uuidOrEmpty,
  // Ruta escrita a mano (02-09): no hace falta ficha en Rutas para planificar.
  route_text: z.string().trim().max(600),
  meeting_time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")),
  warmup_notes: z.string().trim().max(1000),
  icebreaker: z.string().trim().max(1000),
  groups_notes: z.string().trim().max(1000),
  post_run_notes: z.string().trim().max(1000),
  planner_id: uuidOrEmpty,
  route_owner_id: uuidOrEmpty,
  lead_id: uuidOrEmpty,
  sweeper_id: uuidOrEmpty,
  photographer_id: uuidOrEmpty,
  materials: z.string().trim().max(1000),
  sponsor_notes: z.string().trim().max(1000),
  contingency: z.string().trim().max(1000),
  status: z.enum(["borrador", "lista", "ejecutada"]),
});

/**
 * Guarda la planificación de un evento.
 *
 * Es un upsert sobre event_id (único): Fer y Nico entran, editan y guardan
 * cuantas veces quieran sin crear duplicados.
 */
export async function savePlan(formData: FormData): Promise<PlanResult> {
  const member = await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = PlanSchema.safeParse({
    event_id: formData.get("event_id"),
    route_id: formData.get("route_id") ?? "",
    route_text: formData.get("route_text") ?? "",
    meeting_time: formData.get("meeting_time") ?? "",
    warmup_notes: formData.get("warmup_notes") ?? "",
    icebreaker: formData.get("icebreaker") ?? "",
    groups_notes: formData.get("groups_notes") ?? "",
    post_run_notes: formData.get("post_run_notes") ?? "",
    planner_id: formData.get("planner_id") ?? "",
    route_owner_id: formData.get("route_owner_id") ?? "",
    lead_id: formData.get("lead_id") ?? "",
    sweeper_id: formData.get("sweeper_id") ?? "",
    photographer_id: formData.get("photographer_id") ?? "",
    materials: formData.get("materials") ?? "",
    sponsor_notes: formData.get("sponsor_notes") ?? "",
    contingency: formData.get("contingency") ?? "",
    status: formData.get("status") ?? "borrador",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const d = parsed.data;
  const nullIfEmpty = (v: string) => v || null;

  const supabase = await createClient();
  const { error } = await supabase.from("event_plans").upsert(
    {
      event_id: d.event_id,
      route_id: nullIfEmpty(d.route_id),
      route_text: nullIfEmpty(d.route_text),
      meeting_time: nullIfEmpty(d.meeting_time),
      warmup_notes: nullIfEmpty(d.warmup_notes),
      icebreaker: nullIfEmpty(d.icebreaker),
      groups_notes: nullIfEmpty(d.groups_notes),
      post_run_notes: nullIfEmpty(d.post_run_notes),
      planner_id: nullIfEmpty(d.planner_id),
      route_owner_id: nullIfEmpty(d.route_owner_id),
      lead_id: nullIfEmpty(d.lead_id),
      sweeper_id: nullIfEmpty(d.sweeper_id),
      photographer_id: nullIfEmpty(d.photographer_id),
      materials: nullIfEmpty(d.materials),
      sponsor_notes: nullIfEmpty(d.sponsor_notes),
      contingency: nullIfEmpty(d.contingency),
      status: d.status,
      created_by: member.id,
    },
    { onConflict: "event_id" }
  );

  if (error) return { ok: false, error: "No se pudo guardar la planificación." };

  // La ruta elegida se refleja también en el evento, para que aparezca sin
  // tener que abrir la planificación.
  if (d.route_id) {
    await supabase.from("events").update({ route_id: d.route_id }).eq("id", d.event_id);
  }

  revalidatePath("/admin/planificaciones");
  revalidatePath(`/admin/planificaciones/${d.event_id}`);
  revalidatePath("/admin/eventos");
  return { ok: true };
}

// ─── Estructura de la planificación (plantilla real) ─────────────────────────

const BlockSchema = z.object({
  section: z.enum(["inicio", "final", "social"]),
  block_time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")),
  leader_label: z.string().trim().max(120),
  activity: z.string().trim().min(1).max(300),
  notes: z.string().trim().max(500),
});

const PaceGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  distance_km: z.coerce.number().positive().max(99),
  pace_sec_per_km: z.coerce.number().int().min(120).max(1200),
  break_min: z.coerce.number().int().min(0).max(60),
  leaders: z.string().trim().max(200),
  start_offset_min: z.coerce.number().int().min(0).max(180),
});

const ChecklistSchema = z.object({
  label: z.string().trim().min(1).max(200),
  done: z.boolean(),
});

const StructureSchema = z.object({
  event_id: z.string().uuid(),
  blocks: z.array(BlockSchema).max(60),
  groups: z.array(PaceGroupSchema).max(12),
  checklist: z.array(ChecklistSchema).max(40),
});

/**
 * Guarda el itinerario, los grupos de ritmo y el checklist de una planificación.
 *
 * Reemplazo completo en vez de ediciones fila a fila: el editor trabaja con la
 * lista entera en memoria y aquí se persiste tal cual quedó. Con este volumen
 * (decenas de filas) es lo más simple que no puede quedar a medias.
 */
export async function savePlanStructure(formData: FormData): Promise<PlanResult> {
  const member = await requireTeamMember(["socio", "lider_comunidad"]);

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "Datos inválidos" };
  }
  const parsed = StructureSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Revisa los campos: hay filas incompletas." };

  const d = parsed.data;
  const supabase = await createClient();

  // La planificación puede no existir todavía: se crea como borrador.
  const { data: plan, error: planError } = await supabase
    .from("event_plans")
    .upsert({ event_id: d.event_id, created_by: member.id }, { onConflict: "event_id", ignoreDuplicates: false })
    .select("id")
    .single();
  if (planError || !plan) return { ok: false, error: "No se pudo preparar la planificación. ¿Corriste la migración 004?" };

  const wipe = await Promise.all([
    supabase.from("plan_blocks").delete().eq("plan_id", plan.id),
    supabase.from("plan_pace_groups").delete().eq("plan_id", plan.id),
    supabase.from("plan_checklist_items").delete().eq("plan_id", plan.id),
  ]);
  if (wipe.some((r) => r.error)) return { ok: false, error: "No se pudo actualizar la estructura." };

  const inserts = await Promise.all([
    d.blocks.length
      ? supabase.from("plan_blocks").insert(
          d.blocks.map((b, i) => ({
            plan_id: plan.id,
            section: b.section,
            block_time: b.block_time || null,
            leader_label: b.leader_label || null,
            activity: b.activity,
            notes: b.notes || null,
            sort_order: i,
          }))
        )
      : Promise.resolve({ error: null }),
    d.groups.length
      ? supabase.from("plan_pace_groups").insert(
          d.groups.map((g, i) => ({
            plan_id: plan.id,
            name: g.name,
            distance_km: g.distance_km,
            pace_sec_per_km: g.pace_sec_per_km,
            break_min: g.break_min,
            leaders: g.leaders || null,
            start_offset_min: g.start_offset_min,
            sort_order: i,
          }))
        )
      : Promise.resolve({ error: null }),
    d.checklist.length
      ? supabase.from("plan_checklist_items").insert(
          d.checklist.map((c, i) => ({ plan_id: plan.id, label: c.label, done: c.done, sort_order: i }))
        )
      : Promise.resolve({ error: null }),
  ]);
  if (inserts.some((r) => r.error)) return { ok: false, error: "Se guardó a medias; vuelve a intentar." };

  revalidatePath(`/admin/planificaciones/${d.event_id}`);
  revalidatePath("/admin/planificaciones");
  return { ok: true };
}

export interface ExportResult {
  ok: boolean;
  error?: string;
  url?: string;
}

const esc = (v: string | null | undefined) =>
  (v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function paceLabel(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} min/km`;
}

/**
 * Exporta la planificación completa a Drive como Documento de Google, dentro
 * de TEAM STRIDE/Planificaciones. Reexportar crea una versión nueva con la
 * hora en el nombre: nunca pisa la anterior.
 */
export async function exportPlanToDrive(formData: FormData): Promise<ExportResult> {
  await requireTeamMember(["socio", "lider_comunidad"]);

  const eventId = z.string().uuid().safeParse(formData.get("event_id"));
  if (!eventId.success) return { ok: false, error: "Evento inválido" };

  const { driveConfigured, ensureRootFolder, uploadAsGoogleDoc } = await import("@/lib/google-drive");
  if (!driveConfigured()) return { ok: false, error: "Drive no está configurado en este entorno." };

  const supabase = await createClient();
  const [{ data: event }, { data: plan }, { data: team }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId.data).single(),
    supabase.from("event_plans").select("*").eq("event_id", eventId.data).maybeSingle(),
    supabase.from("team_members").select("id, full_name, nickname"),
  ]);
  if (!event) return { ok: false, error: "Evento no encontrado." };
  if (!plan) return { ok: false, error: "Guarda la planificación antes de exportar." };

  const [{ data: blocks }, { data: groups }, { data: checklist }, { data: route }] = await Promise.all([
    supabase.from("plan_blocks").select("*").eq("plan_id", plan.id).order("sort_order"),
    supabase.from("plan_pace_groups").select("*").eq("plan_id", plan.id).order("sort_order"),
    supabase.from("plan_checklist_items").select("*").eq("plan_id", plan.id).order("sort_order"),
    plan.route_id
      ? supabase.from("routes").select("name, distance_km, external_url").eq("id", plan.route_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const person = (id: string | null) => {
    const p = (team ?? []).find((t) => t.id === id);
    return p ? (p.nickname ?? p.full_name) : "—";
  };
  const dateCl = event.event_date.split("-").reverse().join("/");
  const baseTime = (plan.meeting_time ?? event.event_time ?? "").slice(0, 5);

  const blockTable = (section: string, title: string) => {
    const rows = (blocks ?? []).filter((b) => b.section === section);
    if (!rows.length) return "";
    return `<h2>${title}</h2><table border="1"><tr><th>Hora</th><th>Encargado</th><th>Actividad</th><th>Notas</th></tr>${rows
      .map((b) => `<tr><td>${esc(b.block_time?.slice(0, 5))}</td><td>${esc(b.leader_label)}</td><td>${esc(b.activity)}</td><td>${esc(b.notes)}</td></tr>`)
      .join("")}</table>`;
  };

  // Hora real de salida de cada grupo = hora de encuentro + offset escalonado.
  const startClock = (offset: number) => {
    if (!baseTime) return offset === 0 ? "1ª salida" : `+${offset} min`;
    const [h, m] = baseTime.split(":").map(Number);
    const total = h * 60 + m + offset;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  const groupsTable = (groups ?? []).length
    ? `<h2>Desarrollo — grupos y salidas</h2><table border="1"><tr><th>Grupo</th><th>Distancia</th><th>Pace</th><th>Descanso</th><th>Líderes</th><th>Hora de salida</th></tr>${(groups ?? [])
        .map((g) => `<tr><td>${esc(g.name)}</td><td>${g.distance_km} km</td><td>${paceLabel(g.pace_sec_per_km)}</td><td>${g.break_min} min</td><td>${esc(g.leaders)}</td><td>${startClock(g.start_offset_min)}${g.start_offset_min ? ` (+${g.start_offset_min} min)` : ""}</td></tr>`)
        .join("")}</table>`
    : "";

  const checklistHtml = (checklist ?? []).length
    ? `<h2>Checklist</h2><ul>${(checklist ?? []).map((c) => `<li>${c.done ? "☑" : "☐"} ${esc(c.label)}</li>`).join("")}</ul>`
    : "";

  const html = `
<h1>STRIDE — Planificación Social Run</h1>
<table border="1">
<tr><td><b>Evento</b></td><td>${esc(event.title)}</td><td><b>Fecha</b></td><td>${dateCl}${baseTime ? ` · ${baseTime} hrs` : ""}</td></tr>
<tr><td><b>Punto de encuentro</b></td><td>${esc(event.meeting_point)}</td><td><b>Ruta</b></td><td>${esc(route?.name ?? plan.route_text)}${route?.distance_km ? ` (${route.distance_km} km)` : ""}</td></tr>
<tr><td><b>Hora de encuentro</b></td><td>${baseTime || "—"}</td><td><b>Estado</b></td><td>${esc(plan.status)}</td></tr>
<tr><td><b>Planificación</b></td><td>${esc(person(plan.planner_id))}</td><td><b>Ruta a cargo de</b></td><td>${esc(person(plan.route_owner_id))}</td></tr>
<tr><td><b>Lidera</b></td><td>${esc(person(plan.lead_id))}</td><td><b>Cierra / Fotos</b></td><td>${esc(person(plan.sweeper_id))} / ${esc(person(plan.photographer_id))}</td></tr>
</table>
${blockTable("inicio", "Inicio")}
${groupsTable}
${blockTable("final", "Final running")}
${blockTable("social", "Espacio social")}
${plan.materials ? `<h2>Materiales</h2><p>${esc(plan.materials)}</p>` : ""}
${plan.sponsor_notes ? `<h2>Colaborador</h2><p>${esc(plan.sponsor_notes)}</p>` : ""}
${plan.contingency ? `<h2>Plan B</h2><p>${esc(plan.contingency)}</p>` : ""}
${checklistHtml}
<p><i>Exportado desde el ERP STRIDE.</i></p>`;

  try {
    const folder = await ensureRootFolder("Planificaciones");
    const stamp = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false }).replace(/[/:]/g, "-").replace(", ", " ");
    const doc = await uploadAsGoogleDoc(folder, `Planificación — ${event.title} — ${dateCl} (${stamp})`, html);
    return { ok: true, url: doc.webViewLink };
  } catch {
    return { ok: false, error: "Drive rechazó el documento. Intenta de nuevo." };
  }
}
